import {
  paginate,
  queryFingerprint,
} from '@kdtp/governance-query';
import {
  assertProjectAuthorizationPort,
  validateActor,
  validateProjectId,
} from '@kdtp/knowledge-governance';
import { validatePlanId } from '@kdtp/test-plan';
import { validatePlanRecord } from '@kdtp/test-plan-registry';
import { PLAN_QUERY_PAGE_SCHEMA_VERSION } from './constants.js';
import {
  toCoverageView,
  toPlanDetail,
  toPlanSummary,
  toPlanTimeline,
  toProvenanceView,
} from './dto.js';
import { PlanQueryError, planQueryInvariant } from './errors.js';
import { normalizePlanListQuery } from './validation.js';

const REGISTRY_METHODS = Object.freeze(['get', 'list', 'listReviewDecisions']);

export class ReadOnlyTestPlanQueryService {
  constructor({ registry, authorization }) {
    this.registry = assertRegistry(registry);
    this.authorization = assertProjectAuthorizationPort(authorization);
  }

  async listPlans(request) {
    const projectId = validateProjectId(request?.projectId);
    const actor = validateActor(request?.actor);
    await this.#authorize(projectId, actor, 'PLAN_READ');
    const normalized = normalizePlanListQuery(request?.query ?? {});
    let records = await this.registry.list({
      projectId,
      status: normalized.filter.status,
      snapshotId: normalized.filter.snapshotId,
      environmentId: normalized.filter.environmentId,
      releaseId: normalized.filter.releaseId,
    });
    records = records
      .map(validatePlanRecord)
      .filter((record) => record.projectId === projectId)
      .filter((record) => normalized.filter.catalogVersion === undefined
        || record.capabilityCatalog.version === normalized.filter.catalogVersion)
      .sort(planComparator(normalized.sortBy, normalized.direction));
    const summaries = records.map(toPlanSummary);
    const fingerprint = queryFingerprint({
      kind: 'test-plan',
      projectId,
      filter: normalized.filter,
      sortBy: normalized.sortBy,
      direction: normalized.direction,
    });
    const page = paginate(summaries, {
      limit: normalized.limit,
      cursor: normalized.cursor,
      fingerprint,
      itemKey: (item) => item.planId,
      itemTuple: (item) => [item[normalized.sortBy], item.planId],
    });
    return {
      schemaVersion: PLAN_QUERY_PAGE_SCHEMA_VERSION,
      projectId,
      sort: { field: normalized.sortBy, direction: normalized.direction },
      ...page,
    };
  }

  async getPlan(request) {
    const record = await this.#readAuthorizedRecord(request, 'PLAN_READ');
    return toPlanDetail(record);
  }

  async getCoverage(request) {
    const record = await this.#readAuthorizedRecord(request, 'PLAN_READ');
    return toCoverageView(record);
  }

  async getProvenance(request) {
    const record = await this.#readAuthorizedRecord(request, 'PLAN_READ');
    return toProvenanceView(record);
  }

  async getTimeline(request) {
    const record = await this.#readAuthorizedRecord(request, 'PLAN_AUDIT_READ');
    const decisions = await this.registry.listReviewDecisions({
      planId: record.planId,
      projectId: record.projectId,
    });
    return toPlanTimeline(record, decisions);
  }

  async #readAuthorizedRecord(request, action) {
    const projectId = validateProjectId(request?.projectId);
    const actor = validateActor(request?.actor);
    await this.#authorize(projectId, actor, action);
    const planId = validatePlanId(request?.planId);
    const record = await this.registry.get({ planId });
    if (!record || record.projectId !== projectId) {
      throw new PlanQueryError('PLAN_NOT_FOUND', 'Test plan was not found');
    }
    return validatePlanRecord(record);
  }

  async #authorize(projectId, actor, action) {
    const result = await this.authorization.authorize({ projectId, actor, action });
    planQueryInvariant(result && typeof result === 'object' && typeof result.allowed === 'boolean',
      'INVALID_AUTHORIZATION_RESULT', 'Authorization port returned an invalid result');
    planQueryInvariant(result.allowed, 'PLAN_QUERY_FORBIDDEN', 'Actor is not authorized for plan query', {
      projectId,
      actor,
      action,
    });
  }
}

function assertRegistry(registry) {
  planQueryInvariant(registry && typeof registry === 'object',
    'INVALID_PLAN_REGISTRY', 'Test Plan Registry is required');
  for (const method of REGISTRY_METHODS) {
    planQueryInvariant(typeof registry[method] === 'function',
      'INVALID_PLAN_REGISTRY', `Test Plan Registry is missing method ${method}`, { method });
  }
  return registry;
}

function planComparator(sortBy, direction) {
  return (left, right) => {
    let result;
    if (sortBy === 'revision') result = left.revision - right.revision;
    else result = String(left[sortBy]).localeCompare(String(right[sortBy]));
    if (result !== 0) return direction === 'asc' ? result : -result;
    return left.planId.localeCompare(right.planId);
  };
}
