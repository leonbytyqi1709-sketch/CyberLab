import pool from '../config/neon';
import genAI, { GEMINI_MODEL } from '../config/gemini';
import {
  SITUATION_SYSTEM_INSTRUCTION,
  SITUATION_SCHEMA,
  buildSituationPrompt,
  SituationSnapshot,
} from '../ai-engine/prompts';
import { SituationReport } from '../ai-engine/types';
import { isSimulationActive } from './systemControl';
import { recordGeminiCall } from './usageTracker';
import { beginTrace, endTrace } from './aiActivity';

const SITUATION_INTERVAL_MS = 90000;

interface CachedSituation extends SituationReport {
  cached_until: number;
}

let cached: CachedSituation | null = null;
let generating = false;

const fallbackReport = (level: 'GREEN' | 'YELLOW' | 'RED', headline: string, summary: string): SituationReport => ({
  threat_level: level,
  headline,
  summary,
  recommendations: ['Awaiting fresh AI assessment...'],
  generated_at: new Date().toISOString(),
});

const collectSnapshot = async (): Promise<SituationSnapshot> => {
  const [nodes, incidents, recentThreats] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)                                                          AS total,
         COUNT(*) FILTER (WHERE status = 'HEALTHY')                        AS healthy,
         COUNT(*) FILTER (WHERE status = 'WARNING')                        AS warning,
         COUNT(*) FILTER (WHERE status IN ('CRITICAL','UNDER_ATTACK','DOWN','QUARANTINED')) AS critical,
         COALESCE(ROUND(AVG(cpu_usage)::numeric, 0), 0)                    AS avg_cpu,
         COALESCE(ROUND(AVG(ram_usage)::numeric, 0), 0)                    AS avg_ram
       FROM simulated_nodes`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')     AS pending,
         COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
         COUNT(*) FILTER (WHERE status = 'RESOLVED' AND resolved_at > NOW() - INTERVAL '5 minutes') AS resolved_last_5min,
         COUNT(*) FILTER (WHERE status = 'FAILED'   AND resolved_at > NOW() - INTERVAL '5 minutes') AS failed_last_5min
       FROM incident_responses`
    ),
    pool.query(
      `SELECT
         sn.node_name,
         ir.ai_analysis,
         ir.action_taken,
         ir.status,
         EXTRACT(EPOCH FROM (NOW() - sl.created_at)) / 60 AS minutes_ago
       FROM incident_responses ir
       JOIN system_logs sl     ON sl.id = ir.log_id
       JOIN simulated_nodes sn ON sn.id = sl.node_id
       WHERE sl.created_at > NOW() - INTERVAL '5 minutes'
       ORDER BY sl.created_at DESC
       LIMIT 8`
    ),
  ]);

  const n = nodes.rows[0];
  const i = incidents.rows[0];

  return {
    nodes: {
      total:    Number(n.total),
      healthy:  Number(n.healthy),
      warning:  Number(n.warning),
      critical: Number(n.critical),
      avg_cpu:  Number(n.avg_cpu),
      avg_ram:  Number(n.avg_ram),
    },
    incidents: {
      pending:           Number(i.pending),
      in_progress:       Number(i.in_progress),
      resolved_last_5min: Number(i.resolved_last_5min),
      failed_last_5min:  Number(i.failed_last_5min),
    },
    recent_threats: recentThreats.rows.map((r) => {
      let attackType = 'UNKNOWN';
      let action = '—';
      if (r.ai_analysis) {
        try {
          const parsed = JSON.parse(r.ai_analysis);
          attackType = parsed.attack_type || 'UNKNOWN';
          action = parsed.recommended_action || '—';
        } catch { /* ignore */ }
      }
      return {
        node: r.node_name,
        attack_type: attackType,
        action,
        status: r.status,
        minutes_ago: Math.round(Number(r.minutes_ago)),
      };
    }),
  };
};

const generateReport = async (): Promise<void> => {
  if (!isSimulationActive()) return;
  if (generating) return;
  generating = true;
  const startTime = Date.now();
  let traceId = '';
  try {
    const snapshot = await collectSnapshot();
    const promptText = buildSituationPrompt(snapshot);
    traceId = await beginTrace({
      source: 'situation_reporter',
      model: GEMINI_MODEL,
      systemInstruction: SITUATION_SYSTEM_INSTRUCTION,
      prompt: promptText,
    });

    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptText,
      config: {
        systemInstruction: SITUATION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: SITUATION_SCHEMA,
        temperature: 0.3,
      },
    });

    if (!response.text) throw new Error('Empty response');

    const parsed = JSON.parse(response.text) as Omit<SituationReport, 'generated_at'>;
    cached = {
      ...parsed,
      generated_at: new Date().toISOString(),
      cached_until: Date.now() + SITUATION_INTERVAL_MS,
    };
    console.log(`[situation]: ${cached.threat_level} — ${cached.headline}`);
    const elapsed = Date.now() - startTime;
    await recordGeminiCall({
      source: 'situation_reporter',
      model: GEMINI_MODEL,
      success: true,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      durationMs: elapsed,
    });
    await endTrace({
      traceId,
      success: true,
      response: response.text,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      durationMs: elapsed,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const elapsed = Date.now() - startTime;
    console.warn(`[situation]: generation failed — ${msg}`);
    const errorKind = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
      ? 'rate_limit'
      : msg.includes('503') || msg.includes('UNAVAILABLE')
        ? 'unavailable'
        : 'other';
    await recordGeminiCall({
      source: 'situation_reporter',
      model: GEMINI_MODEL,
      success: false,
      durationMs: elapsed,
      errorKind,
    });
    await endTrace({
      traceId,
      success: false,
      durationMs: elapsed,
      errorMessage: msg,
    });
    if (!cached) {
      cached = {
        ...fallbackReport(
          'GREEN',
          'Baseline initialized, awaiting AI briefing',
          'AEGIS is online. The first executive briefing will appear after the next cycle.'
        ),
        cached_until: Date.now() + 30000,
      };
    }
  } finally {
    generating = false;
  }
};

export const getCurrentSituation = (): SituationReport | null => {
  if (!cached) return null;
  const { cached_until: _unused, ...rest } = cached;
  return rest;
};

export const startSituationReporter = async (): Promise<void> => {
  console.log('[situation]: Reporter starting...');
  setTimeout(() => generateReport(), 5000);
  setInterval(() => generateReport(), SITUATION_INTERVAL_MS);
};
