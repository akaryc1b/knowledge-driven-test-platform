import {
  AuthenticatedRequestIdentityContext,
  InMemoryBearerAuthentication,
  ReadOnlyGovernanceHttpTransport,
} from '../src/index.js';
import { ReadOnlyGovernanceQueryHandlers } from '@kdtp/governance-query';

export function createFixture(options = {}) {
  const calls = [];
  const service = {
    async listKnowledge(input) { calls.push(['listKnowledge', input]); return { items: [], page: { limit: 25, hasMore: false, nextCursor: null } }; },
    async getKnowledge(input) { calls.push(['getKnowledge', input]); return { id: input.id, version: input.version }; },
    async getReviewTimeline(input) { calls.push(['getReviewTimeline', input]); return { events: [] }; },
    async listSnapshots(input) { calls.push(['listSnapshots', input]); return { items: [], page: { limit: 25, hasMore: false, nextCursor: null } }; },
    async getSnapshot(input) { calls.push(['getSnapshot', input]); return { snapshotId: input.snapshotId }; },
    ...(options.service ?? {}),
  };
  const handlers = new ReadOnlyGovernanceQueryHandlers({
    service,
    identityContext: new AuthenticatedRequestIdentityContext(),
  });
  const authentication = options.authentication ?? new InMemoryBearerAuthentication([
    { token: 'token-12345678', actor: 'reader', attributes: { source: 'test' } },
  ], { clock: options.clock });
  const transport = new ReadOnlyGovernanceHttpTransport({
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
    url: '/v1/projects/approval-platform/knowledge',
    headers: {
      authorization: 'Bearer token-12345678',
      accept: 'application/json',
      'x-request-id': 'req:test',
    },
    remoteAddress: '127.0.0.1',
    ...overrides,
  };
}
