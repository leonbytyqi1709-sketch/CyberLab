import pool from '../config/neon';

export type NodeRole = 'GATEWAY' | 'WEB' | 'DATABASE' | 'CACHE' | 'SERVICE';

export const inferRole = (nodeName: string): NodeRole => {
  const n = nodeName.toLowerCase();
  if (n.includes('gateway') || n.includes('auth')) return 'GATEWAY';
  if (n.includes('database') || n.includes('db'))  return 'DATABASE';
  if (n.includes('cache')    || n.includes('redis')) return 'CACHE';
  if (n.includes('webserver')|| n.includes('web'))   return 'WEB';
  return 'SERVICE';
};

interface NodeRow { id: string; node_name: string; }

const insertLink = async (
  sourceId: string,
  targetId: string,
  linkType: string
): Promise<void> => {
  await pool.query(
    `INSERT INTO node_links (source_node_id, target_node_id, link_type, status)
     VALUES ($1, $2, $3, 'ACTIVE')
     ON CONFLICT (source_node_id, target_node_id) DO NOTHING`,
    [sourceId, targetId, linkType]
  );
};

export const seedTopology = async (): Promise<void> => {
  const { rows } = await pool.query<NodeRow>('SELECT id, node_name FROM simulated_nodes');
  if (rows.length === 0) return;

  const byRole: Record<NodeRole, NodeRow[]> = {
    GATEWAY: [], WEB: [], DATABASE: [], CACHE: [], SERVICE: [],
  };
  for (const r of rows) byRole[inferRole(r.node_name)].push(r);

  const { rowCount } = await pool.query('SELECT 1 FROM node_links LIMIT 1');
  if (rowCount && rowCount > 0) return;

  console.log('[topology]: Seeding default network topology...');

  for (const gw of byRole.GATEWAY) {
    for (const web of byRole.WEB) {
      await insertLink(gw.id, web.id, 'HTTP_ROUTE');
    }
  }
  for (const web of byRole.WEB) {
    for (const db of byRole.DATABASE)    await insertLink(web.id, db.id, 'DB_QUERY');
    for (const cache of byRole.CACHE)    await insertLink(web.id, cache.id, 'CACHE_READ');
  }
  for (const db of byRole.DATABASE) {
    for (const cache of byRole.CACHE)    await insertLink(db.id, cache.id, 'CACHE_INVALIDATE');
  }
  for (const svc of byRole.SERVICE) {
    for (const gw of byRole.GATEWAY)     await insertLink(gw.id, svc.id, 'INTERNAL');
  }

  console.log('[topology]: Topology seeded');
};

export interface TopologyNode {
  id: string;
  node_name: string;
  ip_address: string;
  status: string;
  role: NodeRole;
  cpu_usage: number;
  ram_usage: number;
  has_active_incident: boolean;
  is_temporary: boolean;
  parent_node_id: string | null;
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  link_type: string;
  status: string;
}

export const getTopology = async (): Promise<{ nodes: TopologyNode[]; links: TopologyLink[] }> => {
  const [nodesRes, linksRes] = await Promise.all([
    pool.query(
      `SELECT sn.id, sn.node_name, sn.ip_address, sn.status, sn.cpu_usage, sn.ram_usage,
              COALESCE(sn.is_temporary, false)    AS is_temporary,
              sn.parent_node_id                   AS parent_node_id,
              EXISTS (
                SELECT 1 FROM incident_responses ir
                JOIN system_logs sl ON sl.id = ir.log_id
                WHERE sl.node_id = sn.id
                  AND ir.status IN ('PENDING','IN_PROGRESS')
              ) AS has_active_incident
         FROM simulated_nodes sn
         ORDER BY sn.is_temporary ASC NULLS FIRST, sn.node_name`
    ),
    pool.query(
      `SELECT id, source_node_id AS source, target_node_id AS target, link_type, status
         FROM node_links`
    ),
  ]);

  const nodes: TopologyNode[] = nodesRes.rows.map((r) => ({
    id: r.id,
    node_name: r.node_name,
    ip_address: r.ip_address,
    status: r.status,
    role: inferRole(r.node_name),
    cpu_usage: Number(r.cpu_usage),
    ram_usage: Number(r.ram_usage),
    has_active_incident: r.has_active_incident,
    is_temporary: Boolean(r.is_temporary),
    parent_node_id: r.parent_node_id ?? null,
  }));

  return { nodes, links: linksRes.rows };
};

export const blockNodeLinks = async (nodeId: string): Promise<number> => {
  const { rowCount } = await pool.query(
    `UPDATE node_links
       SET status = 'BLOCKED'
     WHERE (source_node_id = $1 OR target_node_id = $1)
       AND status = 'ACTIVE'`,
    [nodeId]
  );
  return rowCount ?? 0;
};

export const restoreNodeLinks = async (nodeId: string): Promise<number> => {
  const { rowCount } = await pool.query(
    `UPDATE node_links
       SET status = 'ACTIVE'
     WHERE (source_node_id = $1 OR target_node_id = $1)
       AND status = 'BLOCKED'`,
    [nodeId]
  );
  return rowCount ?? 0;
};
