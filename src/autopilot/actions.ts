import pool from '../config/neon';
import { RecommendedAction } from '../ai-engine/types';
import { blockNodeLinks } from '../services/topology';

export interface ActionContext {
  nodeId: string;
  nodeName: string;
  ipAddress: string;
  parameter: string;
}

export interface ActionResult {
  success: boolean;
  summary: string;
}

export type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>;

const writeAuditLog = async (
  nodeId: string,
  message: string,
  payload: Record<string, unknown>
): Promise<void> => {
  await pool.query(
    `INSERT INTO system_logs (node_id, severity, message, payload)
     VALUES ($1, 'INFO', $2, $3)`,
    [nodeId, message, JSON.stringify(payload)]
  );
};

const restoreNodeHealthy = async (
  nodeId: string,
  resetMetrics: boolean
): Promise<void> => {
  if (resetMetrics) {
    await pool.query(
      `UPDATE simulated_nodes
         SET status = 'HEALTHY',
             cpu_usage = 5,
             ram_usage = 10,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [nodeId]
    );
  } else {
    await pool.query(
      `UPDATE simulated_nodes
         SET status = 'HEALTHY',
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [nodeId]
    );
  }
};

const blockIp: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.ipAddress;
  await restoreNodeHealthy(ctx.nodeId, false);
  await writeAuditLog(
    ctx.nodeId,
    `Firewall rule installed: blocked ${target}`,
    { action: 'BLOCK_IP', target, node: ctx.nodeName }
  );
  return {
    success: true,
    summary: `Blocked IP ${target} via firewall; node ${ctx.nodeName} restored to HEALTHY`,
  };
};

const restartService: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.nodeName;
  await restoreNodeHealthy(ctx.nodeId, true);
  await writeAuditLog(
    ctx.nodeId,
    `Service restart completed: ${target}`,
    { action: 'RESTART_SERVICE', target, node: ctx.nodeName }
  );
  return {
    success: true,
    summary: `Restarted service ${target}; CPU/RAM counters reset`,
  };
};

const scaleResources: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.nodeName;
  await pool.query(
    `UPDATE simulated_nodes
       SET status = 'HEALTHY',
           cpu_usage = 25,
           ram_usage = 30,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ctx.nodeId]
  );
  await writeAuditLog(
    ctx.nodeId,
    `Scaled resources for ${target}`,
    { action: 'SCALE_RESOURCES', target, node: ctx.nodeName }
  );
  return {
    success: true,
    summary: `Provisioned additional capacity for ${target}; load redistributed`,
  };
};

const isolateNode: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.nodeName;
  await pool.query(
    `UPDATE simulated_nodes
       SET status = 'HEALTHY',
           cpu_usage = 0,
           ram_usage = 0,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ctx.nodeId]
  );
  await writeAuditLog(
    ctx.nodeId,
    `Node quarantined and disconnected from network: ${target}`,
    { action: 'ISOLATE_NODE', target, node: ctx.nodeName }
  );
  return {
    success: true,
    summary: `Quarantined ${target}, severed all inbound/outbound traffic, ransomware contained`,
  };
};

const restoreBackup: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.nodeName;
  await pool.query(
    `UPDATE simulated_nodes
       SET status = 'HEALTHY',
           cpu_usage = 15,
           ram_usage = 25,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ctx.nodeId]
  );
  await writeAuditLog(
    ctx.nodeId,
    `Restored from last known-good snapshot: ${target}`,
    { action: 'RESTORE_BACKUP', target, node: ctx.nodeName }
  );
  return {
    success: true,
    summary: `Rolled back ${target} to last verified snapshot; data integrity restored`,
  };
};

const MAX_TOTAL_NODES = 12;

const findFirstByPattern = async (patterns: string[]): Promise<{ id: string; name: string } | null> => {
  for (const pattern of patterns) {
    const { rows } = await pool.query(
      `SELECT id, node_name FROM simulated_nodes WHERE node_name ILIKE $1 LIMIT 1`,
      [`%${pattern}%`]
    );
    if (rows.length > 0) return { id: rows[0].id, name: rows[0].node_name };
  }
  return null;
};

const scaleOut: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.nodeName;

  /* Guard: hard cap to prevent runaway spawning */
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS c FROM simulated_nodes');
  const total = Number(countRows[0].c);
  if (total >= MAX_TOTAL_NODES) {
    await writeAuditLog(
      ctx.nodeId,
      `SCALE_OUT denied: cluster at capacity (${total}/${MAX_TOTAL_NODES} nodes)`,
      { action: 'SCALE_OUT', target, node: ctx.nodeName, denied: 'capacity' }
    );
    return {
      success: false,
      summary: `Cluster at capacity (${total}/${MAX_TOTAL_NODES} nodes) — cannot spawn additional capacity`,
    };
  }

  /* Spawn temporary node */
  const tag = Date.now().toString(36).slice(-4).toUpperCase();
  const newName = `${ctx.nodeName}-scale-${tag}`;
  const newIp = `10.99.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;

  const { rows: newRows } = await pool.query(
    `INSERT INTO simulated_nodes
       (node_name, ip_address, status, cpu_usage, ram_usage, is_temporary, parent_node_id)
     VALUES ($1, $2, 'HEALTHY', 12, 18, true, $3)
     RETURNING id`,
    [newName, newIp, ctx.nodeId]
  );
  const newNodeId = newRows[0].id;

  /* Wire topology: Gateway -> new, new -> DB/Cache */
  const gateway = await findFirstByPattern(['Gateway', 'Auth']);
  const database = await findFirstByPattern(['Database', 'DB-Core']);
  const cache = await findFirstByPattern(['Cache', 'Redis']);

  if (gateway) {
    await pool.query(
      `INSERT INTO node_links (source_node_id, target_node_id, link_type, status)
       VALUES ($1, $2, 'HTTP_ROUTE', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [gateway.id, newNodeId]
    );
  }
  if (database) {
    await pool.query(
      `INSERT INTO node_links (source_node_id, target_node_id, link_type, status)
       VALUES ($1, $2, 'DB_QUERY', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [newNodeId, database.id]
    );
  }
  if (cache) {
    await pool.query(
      `INSERT INTO node_links (source_node_id, target_node_id, link_type, status)
       VALUES ($1, $2, 'CACHE_READ', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [newNodeId, cache.id]
    );
  }

  /* Redistribute load on origin node */
  await pool.query(
    `UPDATE simulated_nodes
       SET status = 'HEALTHY', cpu_usage = 35, ram_usage = 40,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ctx.nodeId]
  );

  await writeAuditLog(
    ctx.nodeId,
    `Auto-scaled out: spawned ${newName} (${newIp}) to absorb load from ${target}`,
    {
      action: 'SCALE_OUT',
      target,
      node: ctx.nodeName,
      spawned_node_id: newNodeId,
      spawned_node_name: newName,
      spawned_ip: newIp,
    }
  );

  return {
    success: true,
    summary:
      `Spawned temporary peer ${newName} (${newIp}); load redistributed from ${target}, ` +
      `cluster capacity +1`,
  };
};

const engageDeepVault: ActionHandler = async (ctx) => {
  /* Find the canonical database node */
  const db = await findFirstByPattern(['Database', 'DB-Core', 'DB']);
  if (!db) {
    return {
      success: false,
      summary: 'No database node found to engage Deep Vault — campaign requires a DB target',
    };
  }

  await pool.query(
    `UPDATE simulated_nodes
       SET status = 'DEEP_VAULT_MODE', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [db.id]
  );

  await writeAuditLog(
    db.id,
    `Deep Vault engaged on ${db.name}: external write access locked`,
    {
      action: 'ENGAGE_DEEP_VAULT',
      target: db.name,
      triggered_by_node: ctx.nodeName,
      release_condition: 'auto-release when no active incidents remain',
    }
  );

  return {
    success: true,
    summary:
      `Engaged DEEP_VAULT_MODE on ${db.name}: external writes blocked, ` +
      `read-only fortress active until threat clears`,
  };
};

const segmentIsolation: ActionHandler = async (ctx) => {
  const target = ctx.parameter?.trim() || ctx.nodeName;
  const blockedLinks = await blockNodeLinks(ctx.nodeId);

  await pool.query(
    `UPDATE simulated_nodes
       SET status = 'ISOLATED',
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ctx.nodeId]
  );

  await writeAuditLog(
    ctx.nodeId,
    `Micro-segmentation enforced: ${blockedLinks} network links blocked for ${target}`,
    {
      action: 'SEGMENT_ISOLATION',
      target,
      node: ctx.nodeName,
      links_blocked: blockedLinks,
    }
  );

  return {
    success: true,
    summary:
      `Micro-segmented ${target}: ${blockedLinks} link(s) severed, ` +
      `node remains alive but cannot communicate with the network`,
  };
};

const ignore: ActionHandler = async (ctx) => {
  await writeAuditLog(
    ctx.nodeId,
    `AEGIS classified incident as non-actionable`,
    { action: 'IGNORE', node: ctx.nodeName }
  );
  return {
    success: true,
    summary: `Incident on ${ctx.nodeName} acknowledged but required no action`,
  };
};

export const ACTION_HANDLERS: Record<RecommendedAction, ActionHandler> = {
  BLOCK_IP: blockIp,
  RESTART_SERVICE: restartService,
  SCALE_RESOURCES: scaleResources,
  SCALE_OUT: scaleOut,
  ISOLATE_NODE: isolateNode,
  RESTORE_BACKUP: restoreBackup,
  SEGMENT_ISOLATION: segmentIsolation,
  ENGAGE_DEEP_VAULT: engageDeepVault,
  IGNORE: ignore,
};
