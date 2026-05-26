import pool from '../config/neon';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export interface AuditEntry {
  actor: string;
  actionType: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: AuditOutcome;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export const writeAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (actor, action_type, resource_type, resource_id, outcome, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actor,
        entry.actionType,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.outcome ?? 'SUCCESS',
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress ?? null,
      ]
    );
  } catch (error) {
    console.error('[audit]: Failed to write audit entry', error, entry);
  }
};
