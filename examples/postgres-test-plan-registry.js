import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import { request, planner } from '../packages/test-planner/test/test-helpers.js';
import {
  applyTestPlanMigrations,
  PostgresTestPlanRegistry,
} from '@kdtp/test-plan-postgres';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
if (!connectionString) throw new Error('KDTP_POSTGRES_TEST_URL is required');
const { Pool } = await import('pg');
const pool = new Pool({ connectionString, max: 4 });
try {
  await applyTestPlanMigrations({ pool });
  const catalog = createBaseCapabilityCatalog('1.0.0');
  const planningResult = await planner(catalog).plan(request({ catalog }));
  const registry = new PostgresTestPlanRegistry({ pool });
  const existing = await registry.get({ planId: planningResult.plan.planId });
  const record = existing ?? await registry.create({
    planningResult,
    actor: 'planner-service',
    at: '2026-07-27T18:00:00.000Z',
    reason: 'PostgreSQL registry example',
  });
  const restored = await new PostgresTestPlanRegistry({ pool }).get({ planId: record.planId });
  process.stdout.write(`${JSON.stringify({
    planId: restored.planId,
    status: restored.status,
    revision: restored.revision,
    restored: restored.contentDigest === record.contentDigest,
  }, null, 2)}\n`);
} finally {
  await pool.end();
}
