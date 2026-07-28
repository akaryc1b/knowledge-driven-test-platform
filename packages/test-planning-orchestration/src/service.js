import { validatePlanningRequest } from '@kdtp/test-plan';
import { validatePlanRecord, TestPlanRegistryError } from '@kdtp/test-plan-registry';
import { validatePlanningResult } from '@kdtp/test-planner';
import { assertPlanningUnitOfWorkPort } from './ports.js';
import { PlanningOrchestrationError, orchestrationInvariant } from './errors.js';

const DUPLICATE_CODES = new Set(['PLAN_EXISTS', 'PLAN_INPUT_EXISTS']);

export class DurablePlanningOrchestrationService {
  constructor({ planner, planningUnitOfWork } = {}) {
    orchestrationInvariant(planner && typeof planner.plan === 'function',
      'INVALID_TEST_PLANNER', 'planner is required');
    this.planner = planner;
    this.unitOfWork = assertPlanningUnitOfWorkPort(planningUnitOfWork);
  }

  async generate(command) {
    const planningRequest = validatePlanningRequest(command?.planningRequest);
    orchestrationInvariant(command?.actor === planningRequest.createdBy,
      'PLAN_GENERATOR_IDENTITY_MISMATCH',
      'Generate actor must equal planning request createdBy');
    const planningResult = validatePlanningResult(await this.planner.plan({ planningRequest }));
    const inputFingerprint = planningResult.plan.inputFingerprint;
    const createCommand = {
      planningResult,
      actor: command.actor,
      at: command.at,
      reason: command.reason,
    };
    try {
      return await this.unitOfWork.execute(async ({ registry, governance }) => {
        const existing = await registry.getByFingerprint({ inputFingerprint });
        if (existing) return idempotentResult(existing, planningResult);
        const record = await governance.generate(createCommand);
        return { record, planningResult, created: true, idempotencyKey: inputFingerprint };
      });
    } catch (error) {
      if (!DUPLICATE_CODES.has(error?.code)) throw error;
      return this.unitOfWork.execute(async ({ registry }) => {
        const existing = await registry.getByFingerprint({ inputFingerprint });
        if (!existing) throw error;
        return idempotentResult(existing, planningResult);
      });
    }
  }

  async submit(command) {
    return this.unitOfWork.execute(({ governance }) => governance.submit(command));
  }

  async review(command) {
    return this.unitOfWork.execute(({ governance }) => governance.review(command));
  }

  async approve(command) {
    return this.unitOfWork.execute(({ governance }) => governance.approve(command));
  }

  async freeze(command) {
    return this.unitOfWork.execute(({ governance }) => governance.freeze(command));
  }

  async read(command) {
    return this.unitOfWork.execute(({ governance }) => governance.read(command));
  }

  async auditTimeline(command) {
    return this.unitOfWork.execute(({ governance }) => governance.auditTimeline(command));
  }

  validate(command) {
    return validatePlanningResult(command?.planningResult ?? command);
  }

  async coverage(command) {
    const record = await this.read(command);
    return Object.freeze({
      planId: record.planId,
      projectId: record.projectId,
      status: record.status,
      revision: record.revision,
      summary: structuredClone(record.planningResult.plan.coverage.summary),
      obligations: structuredClone(record.planningResult.plan.coverage.obligations),
    });
  }
}

function idempotentResult(recordInput, planningResult) {
  const record = validatePlanRecord(recordInput);
  if (record.contentDigest !== planningResult.digest
      || record.planId !== planningResult.plan.planId) {
    throw new PlanningOrchestrationError('IDEMPOTENCY_CONFLICT',
      'Existing input fingerprint is bound to different canonical plan content', {
        planId: record.planId,
        existingDigest: record.contentDigest,
        requestedDigest: planningResult.digest,
      });
  }
  return { record, planningResult, created: false, idempotencyKey: record.inputFingerprint };
}
