import { QUERY_RESPONSE_SCHEMA_VERSION } from './constants.js';
import { QueryError } from './errors.js';
import { assertRequestIdentityContextPort } from './identity-port.js';
import { normalizeRequestId } from './validation.js';

const STATUS_BY_CODE = Object.freeze({
  UNAUTHENTICATED: 401,
  GOVERNANCE_FORBIDDEN: 403,
  KNOWLEDGE_NOT_FOUND: 404,
  SNAPSHOT_NOT_FOUND: 404,
  CURSOR_STALE: 409,
});

const BAD_REQUEST_CODES = new Set([
  'INVALID_QUERY',
  'INVALID_QUERY_FILTER',
  'INVALID_QUERY_SORT',
  'INVALID_PAGE_LIMIT',
  'INVALID_CURSOR',
  'CURSOR_QUERY_MISMATCH',
  'INVALID_REQUEST_ID',
  'INVALID_PROJECT_ID',
  'INVALID_KNOWLEDGE_ID',
  'INVALID_KNOWLEDGE_VERSION',
  'INVALID_SNAPSHOT_QUERY',
  'INVALID_IDENTITY_CONTEXT',
]);

export class ReadOnlyGovernanceQueryHandlers {
  constructor({ service, identityContext }) {
    if (!service || typeof service !== 'object') {
      throw new QueryError('INVALID_QUERY_SERVICE', 'Query service must be an object');
    }
    for (const method of [
      'listKnowledge',
      'getKnowledge',
      'getReviewTimeline',
      'listSnapshots',
      'getSnapshot',
    ]) {
      if (typeof service[method] !== 'function') {
        throw new QueryError('INVALID_QUERY_SERVICE', `Query service is missing method ${method}`);
      }
    }
    this.service = service;
    this.identityContext = assertRequestIdentityContextPort(identityContext);
  }

  async listKnowledge(request) {
    return this.handle(request, (actor) => this.service.listKnowledge({
      projectId: request?.projectId,
      actor,
      query: request?.query ?? {},
    }));
  }

  async getKnowledge(request) {
    return this.handle(request, (actor) => this.service.getKnowledge({
      projectId: request?.projectId,
      actor,
      id: request?.params?.id,
      version: request?.params?.version,
    }));
  }

  async getReviewTimeline(request) {
    return this.handle(request, (actor) => this.service.getReviewTimeline({
      projectId: request?.projectId,
      actor,
      id: request?.params?.id,
      version: request?.params?.version,
    }));
  }

  async listSnapshots(request) {
    return this.handle(request, (actor) => this.service.listSnapshots({
      projectId: request?.projectId,
      actor,
      query: request?.query ?? {},
    }));
  }

  async getSnapshot(request) {
    return this.handle(request, (actor) => this.service.getSnapshot({
      projectId: request?.projectId,
      actor,
      snapshotId: request?.params?.snapshotId,
    }));
  }

  async handle(request, work) {
    let requestId = null;
    try {
      requestId = normalizeRequestId(request?.context?.requestId);
      const identity = await this.identityContext.resolve(request?.context ?? {});
      const data = await work(identity.actor);
      return {
        status: 200,
        body: {
          schemaVersion: QUERY_RESPONSE_SCHEMA_VERSION,
          requestId,
          data,
        },
      };
    } catch (error) {
      return mapQueryError(error, requestId);
    }
  }
}

export function mapQueryError(error, requestId = null) {
  const code = typeof error?.code === 'string' ? error.code : 'QUERY_INTERNAL_ERROR';
  const status = STATUS_BY_CODE[code] ?? (BAD_REQUEST_CODES.has(code) ? 400 : 500);
  const safeCode = status === 500 ? 'QUERY_INTERNAL_ERROR' : code;
  const safeMessage = status === 500
    ? 'The read-only query could not be completed'
    : String(error?.message ?? 'Query request failed');
  return {
    status,
    body: {
      schemaVersion: QUERY_RESPONSE_SCHEMA_VERSION,
      requestId,
      error: {
        code: safeCode,
        message: safeMessage,
      },
    },
  };
}
