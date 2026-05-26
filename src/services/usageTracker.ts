import pool from '../config/neon';

/* Public Gemini pricing per 1M tokens (USD) — kept for billing-ready future */
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash':      { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro':        { input: 1.25, output: 10.00 },
};

/* Google AI Studio FREE TIER limits — empirically observed from 429 responses.
   These can change without notice. Source: actual Gemini API errors + https://ai.google.dev/gemini-api/docs/rate-limits */
const FREE_TIER_RPD: Record<string, number> = {
  'gemini-2.5-flash-lite': 20,
  'gemini-2.5-flash':      20,
  'gemini-2.5-pro':        25,
};

const FREE_TIER_RPM: Record<string, number> = {
  'gemini-2.5-flash-lite': 15,
  'gemini-2.5-flash':      10,
  'gemini-2.5-pro':        5,
};

export type UsageSource = 'siem_correlator' | 'situation_reporter';

export interface UsageRecord {
  source: UsageSource;
  model: string;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  errorKind?: string;
}

const estimateCostUsd = (
  model: string,
  inputTokens?: number,
  outputTokens?: number
): number => {
  const p = PRICING[model];
  if (!p) return 0;
  const inputCost  = ((inputTokens  ?? 0) / 1_000_000) * p.input;
  const outputCost = ((outputTokens ?? 0) / 1_000_000) * p.output;
  return inputCost + outputCost;
};

export const recordGeminiCall = async (record: UsageRecord): Promise<void> => {
  try {
    const cost = estimateCostUsd(record.model, record.inputTokens, record.outputTokens);
    await pool.query(
      `INSERT INTO api_usage
         (source, model, success, input_tokens, output_tokens,
          duration_ms, estimated_cost_usd, error_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.source,
        record.model,
        record.success,
        record.inputTokens ?? null,
        record.outputTokens ?? null,
        record.durationMs ?? null,
        cost,
        record.errorKind ?? null,
      ]
    );
  } catch (error) {
    console.error('[usage]: failed to record call', error);
  }
};

interface BucketTotals {
  calls: number;
  successful_calls: number;
  failed_calls: number;
  tokens: number;
  cost_usd: number;
}

export interface QuotaStatus {
  model: string | null;
  rpm_limit: number | null;
  rpm_used:  number;
  rpm_percent: number;
  rpd_limit: number | null;
  rpd_used:  number;
  rpd_percent: number;
  tier: 'free';
}

export interface UsageSummary {
  last_hour: BucketTotals;
  today:     BucketTotals;
  last_24h:  BucketTotals;
  lifetime:  BucketTotals;
  by_source_today: Array<{
    source: string;
    calls: number;
    cost_usd: number;
    tokens: number;
  }>;
  quota: QuotaStatus;
  active_model: string | null;
  generated_at: string;
}

export const getUsageSummary = async (): Promise<UsageSummary> => {
  const totalsQuery = `
    SELECT
      -- last 60 seconds (for RPM display)
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '60 seconds')                                  AS rpm_used,

      -- last hour
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')                                       AS h_calls,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour' AND success)                          AS h_ok,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour' AND NOT success)                      AS h_fail,
      COALESCE(SUM((COALESCE(input_tokens,0) + COALESCE(output_tokens,0)))
               FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'), 0)                                  AS h_tokens,
      COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'), 0)          AS h_cost,

      -- today (UTC)
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)                                             AS t_calls,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND success)                                 AS t_ok,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND NOT success)                             AS t_fail,
      COALESCE(SUM((COALESCE(input_tokens,0) + COALESCE(output_tokens,0)))
               FILTER (WHERE created_at::date = CURRENT_DATE), 0)                                         AS t_tokens,
      COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at::date = CURRENT_DATE), 0)                 AS t_cost,

      -- last 24h
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')                                    AS d_calls,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND success)                        AS d_ok,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND NOT success)                    AS d_fail,
      COALESCE(SUM((COALESCE(input_tokens,0) + COALESCE(output_tokens,0)))
               FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0)                                AS d_tokens,
      COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0)        AS d_cost,

      -- lifetime
      COUNT(*)                                                                                            AS l_calls,
      COUNT(*) FILTER (WHERE success)                                                                     AS l_ok,
      COUNT(*) FILTER (WHERE NOT success)                                                                 AS l_fail,
      COALESCE(SUM(COALESCE(input_tokens,0) + COALESCE(output_tokens,0)), 0)                              AS l_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)                                                                AS l_cost,

      (SELECT model FROM api_usage ORDER BY created_at DESC LIMIT 1)                                      AS last_model
    FROM api_usage
  `;

  const sourcesQuery = `
    SELECT source,
           COUNT(*)                                                                  AS calls,
           COALESCE(SUM(estimated_cost_usd), 0)                                      AS cost_usd,
           COALESCE(SUM(COALESCE(input_tokens,0) + COALESCE(output_tokens,0)), 0)    AS tokens
      FROM api_usage
     WHERE created_at::date = CURRENT_DATE
     GROUP BY source
     ORDER BY calls DESC
  `;

  const [totalsRes, sourcesRes] = await Promise.all([
    pool.query(totalsQuery),
    pool.query(sourcesQuery),
  ]);
  const r = totalsRes.rows[0];

  const bucket = (callsKey: string, okKey: string, failKey: string, tokensKey: string, costKey: string): BucketTotals => ({
    calls:            Number(r[callsKey]),
    successful_calls: Number(r[okKey]),
    failed_calls:     Number(r[failKey]),
    tokens:           Number(r[tokensKey]),
    cost_usd:         Number(r[costKey]),
  });

  const activeModel: string | null = r.last_model ?? null;
  const rpmLimit = activeModel ? FREE_TIER_RPM[activeModel] ?? null : null;
  const rpdLimit = activeModel ? FREE_TIER_RPD[activeModel] ?? null : null;
  const rpmUsed = Number(r.rpm_used);
  const rpdUsed = Number(r.t_calls);

  const quota: QuotaStatus = {
    model: activeModel,
    rpm_limit: rpmLimit,
    rpm_used:  rpmUsed,
    rpm_percent: rpmLimit ? Math.round((rpmUsed / rpmLimit) * 100) : 0,
    rpd_limit: rpdLimit,
    rpd_used:  rpdUsed,
    rpd_percent: rpdLimit ? Math.round((rpdUsed / rpdLimit) * 100) : 0,
    tier: 'free',
  };

  return {
    last_hour: bucket('h_calls', 'h_ok', 'h_fail', 'h_tokens', 'h_cost'),
    today:     bucket('t_calls', 't_ok', 't_fail', 't_tokens', 't_cost'),
    last_24h:  bucket('d_calls', 'd_ok', 'd_fail', 'd_tokens', 'd_cost'),
    lifetime:  bucket('l_calls', 'l_ok', 'l_fail', 'l_tokens', 'l_cost'),
    by_source_today: sourcesRes.rows.map((s) => ({
      source:   s.source,
      calls:    Number(s.calls),
      cost_usd: Number(s.cost_usd),
      tokens:   Number(s.tokens),
    })),
    quota,
    active_model: activeModel,
    generated_at: new Date().toISOString(),
  };
};
