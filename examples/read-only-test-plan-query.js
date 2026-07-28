import { createPlanQueryFixture, PROJECT } from '../packages/test-plan-query/test/test-helpers.js';

const fixture = await createPlanQueryFixture();
const response = await fixture.handlers.listPlans({
  context: {
    credential: 'reader-token',
    requestId: 'm2-g-query-example',
  },
  projectId: PROJECT,
  query: {
    sortBy: 'createdAt',
    direction: 'asc',
    limit: 10,
  },
});

process.stdout.write(`${JSON.stringify({
  status: response.status,
  schemaVersion: response.body.schemaVersion,
  projectId: response.body.data.projectId,
  planIds: response.body.data.items.map((item) => item.planId),
  statuses: response.body.data.items.map((item) => item.status),
  fingerprintExposed: response.body.data.items.some((item) => Object.hasOwn(item, 'inputFingerprint')),
}, null, 2)}\n`);
