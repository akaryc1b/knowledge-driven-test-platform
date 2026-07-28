import { assertRequestIdentityContextPort } from '@kdtp/governance-query';
import { PLAN_QUERY_RESPONSE_SCHEMA_VERSION } from './constants.js';
import { PlanQueryError } from './errors.js';
import { normalizePlanRequestId } from './validation.js';

const STATUS_BY_CODE = Object.freeze({
  UNAUTHENTICATED: 401,
  PLAN_QUERY_FORBIDDEN: 403,
  PLAN_NOT_FOUND: 404,
  CURSOR_STALE: 409,
});
const BAD_REQUEST_CODES = new Set([
  'INVALID_PLAN_QUERY',
  'INVALID_PLAN_QUERY_FILTER',
  'INVALID_PLAN_QUERY_SORT',
  'INVALID_PAGE_LIMIT',
  'INVALID_CURSOR',
  'CURSOR_QUERY_MISMATCH',
  'INVALID_REQUEST_ID',
  'INVALID_PROJECT_ID',
  'INVALID_PLAN_ID',
  'INVALID_IDENTITY_CONTEXT',
]);

export class ReadOnlyTestPlanQueryHandlers {
  constructor({ service, identityContext }) {
    if (!service || typeof service !== 'object') {
      throw new PlanQueryError('INVALID_PLAN_QUERY_SERVICE', 'Plan query service must be an object');
    }
    for (const method of ['listPlans', 'getPlan', 'getCoverage', 'getProvenance', 'getTimeline']) {
      if (typeof service[method] !== 'function') {
        throw new PlanQueryError('INVALID_PLAN_QUERY_SERVICE', `Plan query service is missing method ${method}`);
      }
    }
    this.service = service;
    this.identityContext = assertRequestIdentityContextPort(identityContext);
  }

  async listPlans(request) {
    return this.#handle(request, (actor) => this.service.listPlans({
      projectId: request?.projectId,
      actor,
      query: request?.query ?? {},
    }));
  }

  async getPlan(request) {
    return this.#byPlan(request, (actor, planId) => this.service.getPlan({
      projectId: request?.projectId, actor, planId,
    }));
  }

  async getCoverage(request) {
    return this.#byPlan(request, (actor, planId) => this.service.getCoverage({
      projectId: request?.projectId, actor, planId,
    }));
  }

  async getProvenance(request) {
    return this.#byPlan(request, (actor, planId) => this.service.getProvenance({
      projectId: request?.projectId, actor, planId,
    }));
  }

  async getTimeline(request) {
    return this.#byPlan(request, (actor, planId) => this.service.getTimeline({
      projectId: request?.projectId, actor, planId,
    }));
  }

  async #byPlan(request, work) {
    return this.#handle(request, (actor) => work(actor, request?.params?.planId));
  }

  async #handle(request, work) {
    let requestId = null;
    try {
      requestId = normalizePlanRequestId(request?.context?.requestId);
      const identity = await this.identityContext.resolve(request?.context ?? {});
      const data = await work(identity.actor);
      return {
        status: 200,
        body: {
          schemaVersion: PLAN_QUERY_RESPONSE_SCHEMA_VERSION,
          requestId,
          data,
        },
      };
    } catch (error) {
      return mapPlanQueryError(error, requestId);
    }
  }
}

export function mapPlanQueryError(error, requestId = null) {
  const code = typeof error?.code === 'string' ? error.code : 'PLAN_QUERY_INTERNAL_ERROR';
  const status = STATUS_BY_CODE[code] ?? (BAD_REQUEST_CODES.has(code) ? 400 : 500);
  return {
    status,
    body: {
      schemaVersion: PLAN_QUERY_RESPONSE_SCHEMA_VERSION,
      requestId,
      error: {
        code: status === 500 ? 'PLAN_QUERY_INTERNAL_ERROR' : code,
        message: status === 500
          ? 'The read-only Test Plan query could not be completed'
          : String(error?.message ?? 'Test Plan query failed'),
      },
    },
  };
}
