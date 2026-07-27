import { GovernanceError } from '@kdtp/knowledge-governance';

export function mapGovernancePostgresError(error, operation) {
  if (error instanceof GovernanceError) return error;
  if (error?.code === '23505') {
    if (error.constraint === 'review_decisions_decision_id_pk') {
      return new GovernanceError('REVIEW_DECISION_EXISTS',
        'Review decision ID already exists', { operation, constraint: error.constraint });
    }
    if (error.constraint === 'review_decisions_reviewer_revision_uq') {
      return new GovernanceError('REVIEWER_ALREADY_DECIDED',
        'Reviewer already recorded a decision for this review revision', {
          operation,
          constraint: error.constraint,
        });
    }
  }
  if (error?.code === '23503') {
    return new GovernanceError('KNOWLEDGE_NOT_FOUND',
      'Governance evidence references a knowledge record that does not exist', {
        operation,
        constraint: error.constraint,
      });
  }
  if (error?.code === '55000') {
    return new GovernanceError('GOVERNANCE_EVIDENCE_IMMUTABLE',
      'Persisted governance evidence cannot be mutated', { operation });
  }
  if (error?.code === '23514' || error?.code === '22P02') {
    return new GovernanceError('GOVERNANCE_STORAGE_CONSTRAINT',
      'Governance evidence violates a PostgreSQL storage constraint', {
        operation,
        constraint: error.constraint,
      });
  }
  return new GovernanceError('GOVERNANCE_STORAGE_ERROR',
    `PostgreSQL governance operation ${operation} failed`, {
      operation,
      postgresCode: error?.code,
      message: error?.message,
    });
}
