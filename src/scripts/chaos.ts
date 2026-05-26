import dotenv from 'dotenv';
import { triggerChaos, ChaosScenario } from '../services/chaos';
import pool from '../config/neon';

dotenv.config();

const SCENARIOS: Record<string, ChaosScenario> = {
  ransomware: 'RANSOMWARE',
  'integrity-loss': 'DATA_INTEGRITY_LOSS',
  integrity: 'DATA_INTEGRITY_LOSS',
};

const usage = () => {
  console.log('');
  console.log('AEGIS Chaos Console (CLI)');
  console.log('-------------------------');
  console.log('Usage:  npm run chaos -- <scenario> [node_name]');
  console.log('');
  console.log('Scenarios:');
  console.log('  ransomware       Inject a simulated ransomware attack');
  console.log('  integrity-loss   Inject a simulated DB integrity failure');
  console.log('');
  console.log('Examples:');
  console.log('  npm run chaos -- ransomware');
  console.log('  npm run chaos -- ransomware Database-Core');
  console.log('  npm run chaos -- integrity-loss');
  console.log('');
};

const main = async (): Promise<void> => {
  const [, , scenarioArg, nodeArg] = process.argv;

  if (!scenarioArg || !SCENARIOS[scenarioArg]) {
    usage();
    if (scenarioArg) console.error(`Unknown scenario: ${scenarioArg}`);
    process.exit(1);
  }

  const scenario = SCENARIOS[scenarioArg];
  console.log(`[chaos-cli]: Injecting ${scenario}${nodeArg ? ` on ${nodeArg}` : ''}...`);

  const result = await triggerChaos(scenario, {
    targetNode: nodeArg,
    actor: 'cli:operator',
    ipAddress: 'cli',
  });

  console.log('[chaos-cli]: ✓ Injection complete');
  console.log(`              scenario      : ${result.scenario}`);
  console.log(`              affected_node : ${result.affected_node}`);
  console.log(`              incident_id   : ${result.incident_id}`);
  console.log('');
  console.log('AEGIS pipeline will analyze and respond within ~30 seconds.');
  console.log('Watch the dashboard or server logs to see the response.');

  await pool.end();
};

main().catch((err) => {
  console.error('[chaos-cli]: FAILED', err);
  process.exit(1);
});
