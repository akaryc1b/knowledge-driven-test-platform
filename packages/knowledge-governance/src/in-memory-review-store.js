import { ReviewDecisionStorePort } from './ports.js';
import { GovernanceError, governanceInvariant } from './errors.js';
import { validateProjectId, validateReviewDecision } from './validation.js';

export class InMemoryReviewDecisionStore extends ReviewDecisionStorePort {
  constructor() {
    super();
    this.decisions = new Map();
    this.reviewerKeys = new Set();
  }

  async append(input) {
    const decision = validateReviewDecision(input);
    governanceInvariant(!this.decisions.has(decision.decisionId),
      'REVIEW_DECISION_EXISTS', `Review decision ${decision.decisionId} already exists`, {
        decisionId: decision.decisionId,
      });
    const reviewerKey = `${decision.projectId}\u0000${decision.knowledgeKey}\u0000${decision.reviewRevision}\u0000${decision.reviewer}`;
    governanceInvariant(!this.reviewerKeys.has(reviewerKey),
      'REVIEWER_ALREADY_DECIDED', 'Reviewer already recorded a decision for this review revision', {
        reviewer: decision.reviewer,
        knowledgeKey: decision.knowledgeKey,
        reviewRevision: decision.reviewRevision,
      });
    this.decisions.set(decision.decisionId, structuredClone(decision));
    this.reviewerKeys.add(reviewerKey);
    return structuredClone(decision);
  }

  async list(filter = {}) {
    if (filter.projectId !== undefined) validateProjectId(filter.projectId);
    if (filter.reviewRevision !== undefined) {
      governanceInvariant(Number.isSafeInteger(filter.reviewRevision) && filter.reviewRevision > 0,
        'INVALID_REVIEW_FILTER', 'reviewRevision must be a positive integer');
    }
    const output = [...this.decisions.values()].filter((decision) => (
      (filter.projectId === undefined || decision.projectId === filter.projectId) &&
      (filter.knowledgeKey === undefined || decision.knowledgeKey === filter.knowledgeKey) &&
      (filter.reviewRevision === undefined || decision.reviewRevision === filter.reviewRevision) &&
      (filter.reviewer === undefined || decision.reviewer === filter.reviewer) &&
      (filter.decision === undefined || decision.decision === filter.decision)
    ));
    output.sort((left, right) => left.at.localeCompare(right.at) || left.decisionId.localeCompare(right.decisionId));
    return structuredClone(output);
  }
}
