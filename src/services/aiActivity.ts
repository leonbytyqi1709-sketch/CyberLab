import pool from '../config/neon';

const TRACE_MAX_RETAIN = 50;
const PROMPT_TRUNCATE  = 4000;
const RESPONSE_TRUNCATE = 4000;
const SYSTEM_TRUNCATE   = 1200;

export type ActivitySource = 'siem_correlator' | 'situation_reporter';

interface InFlightEntry {
  traceId: string;
  source: ActivitySource;
  startedAt: number;
}

const inFlight = new Map<string, InFlightEntry>();

const truncate = (text: string, max: number): string => {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... [truncated, total ${text.length} chars]`;
};

export interface BeginTraceInput {
  source: ActivitySource;
  model: string;
  systemInstruction: string;
  prompt: string;
}

export const beginTrace = async (input: BeginTraceInput): Promise<string> => {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO api_call_traces
         (source, model, status, system_instruction_preview, prompt_preview)
       VALUES ($1, $2, 'in_flight', $3, $4)
       RETURNING id`,
      [
        input.source,
        input.model,
        truncate(input.systemInstruction, SYSTEM_TRUNCATE),
        truncate(input.prompt, PROMPT_TRUNCATE),
      ]
    );
    const traceId = rows[0].id;
    inFlight.set(traceId, {
      traceId,
      source: input.source,
      startedAt: Date.now(),
    });
    return traceId;
  } catch (error) {
    console.error('[ai-activity]: beginTrace failed', error);
    return '';
  }
};

export interface EndTraceInput {
  traceId: string;
  success: boolean;
  response?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  errorMessage?: string;
}

export const endTrace = async (input: EndTraceInput): Promise<void> => {
  if (!input.traceId) return;
  inFlight.delete(input.traceId);
  try {
    await pool.query(
      `UPDATE api_call_traces
         SET status = $1,
             response_preview = $2,
             input_tokens = $3,
             output_tokens = $4,
             duration_ms = $5,
             error_message = $6,
             finished_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        input.success ? 'success' : 'failed',
        input.response ? truncate(input.response, RESPONSE_TRUNCATE) : null,
        input.inputTokens ?? null,
        input.outputTokens ?? null,
        input.durationMs ?? null,
        input.errorMessage ? truncate(input.errorMessage, 800) : null,
        input.traceId,
      ]
    );

    /* Prune to last N traces */
    await pool.query(
      `DELETE FROM api_call_traces
        WHERE id IN (
          SELECT id FROM api_call_traces
          ORDER BY started_at DESC
          OFFSET $1
        )`,
      [TRACE_MAX_RETAIN]
    );
  } catch (error) {
    console.error('[ai-activity]: endTrace failed', error);
  }
};

export interface InFlightSnapshot {
  trace_id: string;
  source: ActivitySource;
  started_at: string;
  elapsed_ms: number;
}

export interface TraceRecord {
  id: string;
  source: string;
  model: string;
  status: string;
  system_instruction_preview: string | null;
  prompt_preview: string | null;
  response_preview: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface AiActivitySnapshot {
  in_flight: InFlightSnapshot[];
  traces: TraceRecord[];
  generated_at: string;
}

export const getInFlightSnapshot = (): InFlightSnapshot[] => {
  const now = Date.now();
  return Array.from(inFlight.values()).map((e) => ({
    trace_id: e.traceId,
    source: e.source,
    started_at: new Date(e.startedAt).toISOString(),
    elapsed_ms: now - e.startedAt,
  }));
};

export const getRecentTraces = async (limit = 20): Promise<TraceRecord[]> => {
  const safeLimit = Math.min(Math.max(1, limit), TRACE_MAX_RETAIN);
  const { rows } = await pool.query<TraceRecord>(
    `SELECT id, source, model, status,
            system_instruction_preview, prompt_preview, response_preview,
            input_tokens, output_tokens, duration_ms, error_message,
            started_at, finished_at
       FROM api_call_traces
      ORDER BY started_at DESC
      LIMIT $1`,
    [safeLimit]
  );
  return rows;
};

export const getActivitySnapshot = async (limit = 20): Promise<AiActivitySnapshot> => ({
  in_flight: getInFlightSnapshot(),
  traces:    await getRecentTraces(limit),
  generated_at: new Date().toISOString(),
});
