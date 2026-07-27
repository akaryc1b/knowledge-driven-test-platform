import { DEFAULT_REQUIRED_APPROVALS } from './constants.js';
import { GovernanceError, governanceInvariant } from './errors.js';
import { validateActor } from './validation.js';

export class GovernancePolicy {
  constructor(options = {}) {
    this.requiredApprovals = {
      ...DEFAULT_REQUIRED_APPROVALS,
      ...(options.requiredApprovals ?? {}),
    };
    this.requireOriginalAuthorToSubmit = options.requireOriginalAuthorToSubmit ?? true;
    this.authorCannotReview = options.authorCannotReview ?? true;
    this.authorCannotPublish = options.authorCannotPublish ?? true;
    for (const [risk, count] of Object.entries(this.requiredApprovals)) {
      governanceInvariant(Number.isSafeInteger(count) && count > 0,
        'INVALID_GOVERNANCE_POLICY', 'Required approval count must be a positive integer', {
          risk,
          count,
        });
    }
  }

  assertSubmitAllowed(record, actor) {
    const normalizedActor = validateActor(actor);
    if (this.requireOriginalAuthorToSubmit) {
      governanceInvariant(originalAuthor(record) === normalizedActor,
        'ONLY_ORIGINAL_AUTHOR_CAN_SUBMIT', 'Only the original author can submit knowledge for review', {
          author: originalAuthor(record),
          actor: normalizedActor,
          key: record.key,
        });
    }
  }

  assertReviewerAllowed(record, reviewer) {
    const normalizedReviewer = validateActor(reviewer);
    if (this.authorCannotReview) {
      governanceInvariant(originalAuthor(record) !== normalizedReviewer,
        'AUTHOR_REVIEW_FORBIDDEN', 'Knowledge author cannot review their own knowledge', {
          author: originalAuthor(record),
          reviewer: normalizedReviewer,
          key: record.key,
        });
    }
  }

  evaluatePublish(record, decisions, publisher) {
    const normalizedPublisher = validateActor(publisher);
    governanceInvariant(record?.knowledge?.status === 'REVIEWING',
      'KNOWLEDGE_NOT_REVIEWING', 'Knowledge must be REVIEWING before publication', {
        key: record?.key,
        status: record?.knowledge?.status,
      });
    if (this.authorCannotPublish) {
      governanceInvariant(originalAuthor(record) !== normalizedPublisher,
        'AUTHOR_PUBLISH_FORBIDDEN', 'Knowledge author cannot publish their own knowledge', {
          author: originalAuthor(record),
          publisher: normalizedPublisher,
          key: record.key,
        });
    }

    const current = decisions.filter((decision) => (
      decision.knowledgeKey === record.key &&
      decision.reviewRevision === record.revision
    ));
    governanceInvariant(current.every((decision) => decision.decision === 'APPROVE'),
      'REVIEW_CHANGES_PENDING', 'Review revision contains a non-approval decision', {
        key: record.key,
        revision: record.revision,
      });
    if (this.authorCannotReview) {
      governanceInvariant(current.every((decision) => decision.reviewer !== originalAuthor(record)),
        'AUTHOR_REVIEW_FORBIDDEN', 'Publish evidence contains an author self-review', {
          author: originalAuthor(record),
          key: record.key,
          revision: record.revision,
        });
    }
    const reviewers = [...new Set(current.map((decision) => decision.reviewer))].sort();
    const required = this.requiredApprovals[record.knowledge.riskLevel];
    governanceInvariant(reviewers.length >= required,
      'INSUFFICIENT_APPROVALS', 'Knowledge does not have enough distinct approvals', {
        key: record.key,
        revision: record.revision,
        riskLevel: record.knowledge.riskLevel,
        required,
        actual: reviewers.length,
      });
    return { requiredApprovals: required, reviewers };
  }
}

export function originalAuthor(record) {
  const author = record?.history?.[0]?.actor;
  if (typeof author !== 'string' || author.length === 0) {
    throw new GovernanceError('KNOWLEDGE_AUTHOR_MISSING', 'Registry record does not contain an original author', {
      key: record?.key,
    });
  }
  return author;
}
