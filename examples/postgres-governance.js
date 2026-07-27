import { Pool } from 'pg';
import { InMemoryProjectAuthorization, KnowledgeGovernanceService } from '../packages/knowledge-governance/src/index.js';
import {
  PostgresGovernanceUnitOfWork,
  PostgresKnowledgeSnapshotStore,
  PostgresReviewDecisionStore,
  applyGovernancePostgresMigrations,
} from '../packages/knowledge-governance-postgres/src/index.js';
import { PostgresKnowledgeRegistry, applyPostgresMigrations } from '../packages/knowledge-registry-postgres/src/index.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
if (!connectionString) throw new Error('KDTP_POSTGRES_TEST_URL is required');
const pool = new Pool({ connectionString });
try {
  await applyPostgresMigrations({ pool });
  await applyGovernancePostgresMigrations({ pool });
  const projectId = 'approval-platform';
  const registry = new PostgresKnowledgeRegistry({ pool });
  const reviewStore = new PostgresReviewDecisionStore({ pool });
  const snapshotStore = new PostgresKnowledgeSnapshotStore({ pool });
  const authorization = new InMemoryProjectAuthorization([
    { projectId, actor: 'durable-author', actions: ['KNOWLEDGE_CREATE', 'KNOWLEDGE_SUBMIT'], roles: ['author'] },
    { projectId, actor: 'durable-reviewer', actions: ['KNOWLEDGE_REVIEW'], roles: ['reviewer'] },
    { projectId, actor: 'durable-publisher', actions: ['KNOWLEDGE_PUBLISH'], roles: ['publisher'] },
  ]);
  const service = new KnowledgeGovernanceService({
    registry, reviewStore, snapshotStore, authorization,
    unitOfWork: new PostgresGovernanceUnitOfWork({ pool }),
  });
  let record = await service.createDraft({
    projectId,
    knowledge: {
      schemaVersion: 'knowledge-rule/v1', id: 'PROJECT-DURABLE-GOV-001',
      boundaryKey: 'governance.durable-evidence', name: '持久化治理证据',
      version: '1.0.0', status: 'DRAFT', scope: { level: 'PROJECT', key: projectId },
      enforcement: 'mandatory', overridePolicy: 'deny', enabled: true,
      value: { durable: true }, owner: 'quality-platform-team',
      source: 'M1-D durable governance example', riskLevel: 'high',
    },
    actor: 'durable-author', at: '2026-07-27T12:00:00.000Z',
    reason: 'create durable governance example',
  });
  record = await service.submitForReview({
    projectId, id: record.knowledge.id, version: record.knowledge.version,
    expectedRevision: record.revision, actor: 'durable-author',
    at: '2026-07-27T12:01:00.000Z', reason: 'submit durable governance example',
  });
  await service.review({
    projectId, id: record.knowledge.id, version: record.knowledge.version,
    expectedRevision: record.revision, decisionId: 'decision:durable:example:0001',
    decision: 'APPROVE', actor: 'durable-reviewer',
    at: '2026-07-27T12:02:00.000Z', reason: 'approve durable governance example',
  });
  const published = await service.publish({
    projectId, id: record.knowledge.id, version: record.knowledge.version,
    expectedRevision: record.revision, actor: 'durable-publisher',
    at: '2026-07-27T12:03:00.000Z', reason: 'publish durable governance example',
  });
  process.stdout.write(`${JSON.stringify(published, null, 2)}\n`);
} finally {
  await pool.end();
}
