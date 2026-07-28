import { TestPlanRegistryError } from '@kdtp/test-plan-registry';

export function mapTestPlanPostgresError(error, operation) {
  if (error instanceof TestPlanRegistryError) return error;
  if (error?.code === '23505') {
    if (error.constraint === 'test_plan_records_pkey') {
      return withCause(new TestPlanRegistryError('PLAN_EXISTS',
        'Test plan ID already exists', { operation, constraint: error.constraint }), error);
    }
    if (error.constraint === 'test_plan_records_input_fingerprint_uq') {
      return withCause(new TestPlanRegistryError('PLAN_INPUT_EXISTS',
        'A test plan already exists for the canonical planning input', {
          operation,
          constraint: error.constraint,
        }), error);
    }
    if (error.constraint === 'test_plan_review_decisions_pkey') {
      return withCause(new TestPlanRegistryError('PLAN_REVIEW_DECISION_EXISTS',
        'Plan review decision already exists', { operation, constraint: error.constraint }), error);
    }
    if (error.constraint === 'test_plan_review_decisions_reviewer_revision_uq') {
      return withCause(new TestPlanRegistryError('REVIEWER_ALREADY_DECIDED',
        'Reviewer already recorded a decision for this plan revision', {
          operation, constraint: error.constraint,
        }), error);
    }
  }
  if (error?.code === '23503') {
    if (error.constraint === 'test_plan_review_decisions_plan_project_fk') {
      return withCause(new TestPlanRegistryError('PLAN_REVIEW_BINDING_MISMATCH',
        'Review decision project does not match plan project', {
          operation,
          constraint: error.constraint,
        }), error);
    }
    return withCause(new TestPlanRegistryError('PLAN_REVISION_NOT_FOUND',
      'Review decision references a plan revision that does not exist', {
        operation,
        constraint: error.constraint,
      }), error);
  }
  if (error?.code === '55000') {
    return withCause(new TestPlanRegistryError('PLAN_STORAGE_IMMUTABLE',
      'Persisted test plan state or evidence is immutable', { operation }), error);
  }
  if (['23502', '23514', '22P02', '22003'].includes(error?.code)) {
    return withCause(new TestPlanRegistryError('PLAN_STORAGE_CONSTRAINT',
      'PostgreSQL rejected test plan data because a storage constraint was violated', {
        operation,
        postgresCode: error.code,
        constraint: error.constraint,
      }), error);
  }
  return withCause(new TestPlanRegistryError('PLAN_STORAGE_ERROR',
    'PostgreSQL test plan registry operation failed', {
      operation,
      postgresCode: error?.code,
      constraint: error?.constraint,
    }), error);
}

function withCause(mapped, cause) {
  mapped.cause = cause;
  if (process.env.CI === 'true') {
    mapped.stack = `${mapped.stack}\nINTERNAL_CAUSE ${cause?.name ?? 'Error'} ${cause?.code ?? ''}: ${cause?.message ?? String(cause)}`;
  }
  return mapped;
}
