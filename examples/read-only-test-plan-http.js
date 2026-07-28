import { once } from 'node:events';
import {
  AuthenticatedRequestIdentityContext,
  InMemoryBearerAuthentication,
  InMemoryFixedWindowRateLimiter,
} from '@kdtp/governance-http';
import {
  ReadOnlyTestPlanQueryHandlers,
} from '@kdtp/test-plan-query';
import {
  ReadOnlyTestPlanHttpTransport,
  createReadOnlyTestPlanNodeHttpServer,
} from '@kdtp/test-plan-http';
import { createPlanQueryFixture, PROJECT } from '../packages/test-plan-query/test/test-helpers.js';

const fixture = await createPlanQueryFixture();
const handlers = new ReadOnlyTestPlanQueryHandlers({
  service: fixture.service,
  identityContext: new AuthenticatedRequestIdentityContext(),
});
const transport = new ReadOnlyTestPlanHttpTransport({
  handlers,
  authentication: new InMemoryBearerAuthentication([
    { token: 'm2-g-http-token', actor: 'auditor' },
  ]),
  rateLimiter: new InMemoryFixedWindowRateLimiter({ limit: 20, windowMs: 60_000 }),
});
const server = createReadOnlyTestPlanNodeHttpServer({ transport });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const address = server.address();
  const response = await fetch(
    `http://127.0.0.1:${address.port}/v1/projects/${PROJECT}/test-plans/${fixture.frozen.planId}/timeline`,
    {
      headers: {
        authorization: 'Bearer m2-g-http-token',
        accept: 'application/json',
        'x-request-id': 'm2-g-http-example',
      },
    },
  );
  const body = await response.json();
  process.stdout.write(`${JSON.stringify({
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    cacheControl: response.headers.get('cache-control'),
    planId: body.data.planId,
    revision: body.data.revision,
    timelineEntries: body.data.events.length,
  }, null, 2)}\n`);
} finally {
  server.close();
  await once(server, 'close');
}
