import {
  AuthenticatedRequestIdentityContext,
  InMemoryBearerAuthentication,
} from '@kdtp/governance-http';
import { ReadOnlyTestPlanQueryHandlers } from '@kdtp/test-plan-query';
import { ReadOnlyTestPlanHttpTransport } from '../src/index.js';

export function createFixture(options = {}) {
  const calls = [];
  const service = {
    async listPlans(input) {
      calls.push(['listPlans', input]);
      return { items: [], page: { limit: 25, hasMore: false, nextCursor: null } };
    },
    async getPlan(input) { calls.push(['getPlan', input]); return { planId: input.planId }; },
    async getCoverage(input) { calls.push(['getCoverage', input]); return { planId: input.planId, coverage: {} }; },
    async getProvenance(input) { calls.push(['getProvenance', input]); return { planId: input.planId, provenance: {} }; },
    async getTimeline(input) { calls.push(['getTimeline', input]); return { planId: input.planId, events: [] }; },
    ...(options.service ?? {}),
  };
  const handlers = new ReadOnlyTestPlanQueryHandlers({
    service,
    identityContext: new AuthenticatedRequestIdentityContext(),
  });
  const authentication = options.authentication ?? new InMemoryBearerAuthentication([
    { token: 'token-12345678', actor: 'reader', attributes: { source: 'test' } },
  ], { clock: options.clock });
  const transport = new ReadOnlyTestPlanHttpTransport({
    handlers,
    authentication,
    rateLimiter: options.rateLimiter,
    clock: options.clock,
    requestIdFactory: options.requestIdFactory ?? (() => 'req:generated'),
    maxBodyBytes: options.maxBodyBytes,
  });
  return { transport, calls, service, handlers, authentication };
}

export function request(overrides = {}) {
  return {
    method: 'GET',
    url: '/v1/projects/approval-platform/test-plans',
    headers: {
      authorization: 'Bearer token-12345678',
      accept: 'application/json',
      'x-request-id': 'req:test-plan',
    },
    remoteAddress: '127.0.0.1',
    ...overrides,
  };
}
