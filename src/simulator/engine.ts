import pool from '../config/neon';
import { SimulatedNode } from '../models/interfaces';

const INITIAL_NODES = [
  { node_name: 'Webserver-01', ip_address: '192.168.1.10' },
  { node_name: 'Webserver-02', ip_address: '192.168.1.11' },
  { node_name: 'Database-Core', ip_address: '10.0.0.5' },
  { node_name: 'Auth-Gateway', ip_address: '10.0.0.2' },
  { node_name: 'Cache-Redis', ip_address: '10.0.0.20' },
];

const ATTACK_SCENARIOS = [
  'SSH Brute-Force attack detected from unknown IP.',
  'High volume of 404 requests indicating a directory traversal scan.',
  'Memory buffer overflow attempt on port 8080.',
  'Unexpected root access detected via unauthorized terminal.',
  'DDoS mitigation triggered due to packet flood.',
];

export const startSimulator = async () => {
  console.log('[simulator]: Engine starting...');

  // 1. Ensure nodes exist
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

  // 2. Interval for updates (every 10 seconds)
  setInterval(async () => {
    try {
      const { rows: nodes } = await pool.query('SELECT * FROM simulated_nodes');
      
      for (const node of nodes as SimulatedNode[]) {
        const shouldBeUnderAttack = Math.random() < 0.15;
        const cpu = Math.floor(Math.random() * 100);
        const ram = Math.floor(Math.random() * 100);
        let status = 'HEALTHY';

        if (shouldBeUnderAttack) {
          status = Math.random() > 0.5 ? 'UNDER_ATTACK' : 'CRITICAL';
          const message = ATTACK_SCENARIOS[Math.floor(Math.random() * ATTACK_SCENARIOS.length)];
          
          console.warn(`[simulator]: INCIDENT on ${node.node_name} - ${message}`);
          
          // Log the incident
          const logResult = await pool.query(
            'INSERT INTO system_logs (node_id, severity, message, payload) VALUES ($1, $2, $3, $4) RETURNING id',
            [node.id, 'CRITICAL', message, JSON.stringify({ cpu, ram, timestamp: new Date() })]
          );

          // Create an initial incident response record
          await pool.query(
            'INSERT INTO incident_responses (log_id, status) VALUES ($1, $2)',
            [logResult.rows[0].id, 'PENDING']
          );
        } else if (cpu > 80 || ram > 80) {
          status = 'WARNING';
        }

        // Update node metrics
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
