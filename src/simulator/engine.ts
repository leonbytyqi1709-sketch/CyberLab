import pool from '../config/neon';
import { SimulatedNode } from '../models/interfaces';
import { seedTopology } from '../services/topology';
import { isSimulationActive } from '../services/systemControl';

const INITIAL_NODES = [
  { node_name: 'Auth-Gateway',  ip_address: '10.0.0.2'    },
  { node_name: 'Webserver-01',  ip_address: '192.168.1.10' },
  { node_name: 'Webserver-02',  ip_address: '192.168.1.11' },
  { node_name: 'Database-Core', ip_address: '10.0.0.5'    },
  { node_name: 'Cache-Redis',   ip_address: '10.0.0.20'   },
];

const ATTACK_SCENARIOS = [
  'SSH Brute-Force attack detected from unknown IP.',
  'High volume of 404 requests indicating a directory traversal scan.',
  'Memory buffer overflow attempt on port 8080.',
  'Unexpected root access detected via unauthorized terminal.',
  'DDoS mitigation triggered due to packet flood.',
];

const IMMUTABLE_STATUSES = new Set(['ISOLATED', 'QUARANTINED', 'DEEP_VAULT_MODE']);
const SKIP_ATTACK_STATUSES = new Set(['ISOLATED', 'QUARANTINED', 'DEEP_VAULT_MODE']);

export const startSimulator = async () => {
  console.log('[simulator]: Engine starting...');

  const { rowCount } = await pool.query('SELECT * FROM simulated_nodes');
  if (rowCount === 0) {
    console.log('[simulator]: No nodes found. Seeding initial infrastructure...');
    for (const node of INITIAL_NODES) {
      await pool.query(
        'INSERT INTO simulated_nodes (node_name, ip_address, status) VALUES ($1, $2, $3)',
        [node.node_name, node.ip_address, 'HEALTHY']
      );
    }
  }

  await seedTopology();

  setInterval(async () => {
    if (!isSimulationActive()) return;
    try {
      const { rows: nodes } = await pool.query('SELECT * FROM simulated_nodes');

      for (const node of nodes as (SimulatedNode & { is_temporary?: boolean })[]) {
        if (IMMUTABLE_STATUSES.has(node.status)) {
          continue;
        }

        /* Temporary scaled-out nodes only show benign metrics — they're absorbing load,
           not real attack targets in this simulation. */
        if (node.is_temporary) {
          const cpu = 20 + Math.floor(Math.random() * 30);
          const ram = 25 + Math.floor(Math.random() * 25);
          await pool.query(
            'UPDATE simulated_nodes SET cpu_usage = $1, ram_usage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [cpu, ram, node.id]
          );
          continue;
        }

        const shouldBeUnderAttack = !SKIP_ATTACK_STATUSES.has(node.status) && Math.random() < 0.15;
        const cpu = Math.floor(Math.random() * 100);
        const ram = Math.floor(Math.random() * 100);
        let status = 'HEALTHY';

        if (shouldBeUnderAttack) {
          status = Math.random() > 0.5 ? 'UNDER_ATTACK' : 'CRITICAL';
          const message = ATTACK_SCENARIOS[Math.floor(Math.random() * ATTACK_SCENARIOS.length)];

          console.warn(`[simulator]: INCIDENT on ${node.node_name} - ${message}`);

          const logResult = await pool.query(
            'INSERT INTO system_logs (node_id, severity, message, payload) VALUES ($1, $2, $3, $4) RETURNING id',
            [node.id, 'CRITICAL', message, JSON.stringify({ cpu, ram, timestamp: new Date() })]
          );

          await pool.query(
            'INSERT INTO incident_responses (log_id, status) VALUES ($1, $2)',
            [logResult.rows[0].id, 'PENDING']
          );
        } else if (cpu > 80 || ram > 80) {
          status = 'WARNING';
        }

        await pool.query(
          'UPDATE simulated_nodes SET cpu_usage = $1, ram_usage = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
          [cpu, ram, status, node.id]
        );
      }

      console.log(`[simulator]: Metrics updated for ${nodes.length} nodes.`);
    } catch (error) {
      console.error('[simulator]: Update cycle failed', error);
    }
  }, 10000);
};
