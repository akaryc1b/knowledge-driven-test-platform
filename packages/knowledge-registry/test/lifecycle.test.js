import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createKnowledgeRecord,
  RegistryError,
  replaceDraftRecord,
  transitionKnowledgeRecord,
} from '../src/index.js';
import { createCommand, knowledge, T0, T1, T2, transitionCommand } from './test-helpers.js';

test('review can request changes back to draft', () => {
  let record = createKnowledgeRecord(createCommand());
  record = transitionKnowledgeRecord(record, transitionCommand(record, 'REVIEWING', T1));
  record = transitionKnowledgeRecord(record, transitionCommand(record, 'DRAFT', T2, {
    reason: 'clarify acceptance criteria',
  }));

  assert.equal(record.knowledge.status, 'DRAFT');
  assert.equal(record.history.at(-1).fromStatus, 'REVIEWING');
});

test('draft cannot publish without review', () => {
  const record = createKnowledgeRecord(createCommand());
  assert.throws(
    () => transitionKnowledgeRecord(record, transitionCommand(record, 'PUBLISHED', T1)),
    (error) => error instanceof RegistryError && error.code === 'INVALID_STATUS_TRANSITION',
  );
});

test('draft replacement cannot change identity', () => {
  const record = createKnowledgeRecord(createCommand());
  assert.throws(
    () => replaceDraftRecord(record, {
      expectedRevision: 1,
      knowledge: knowledge({ id: 'PROJECT-SAMPLE-002' }),
      actor: 'quality-engineer',
      at: T1,
      reason: 'invalid identity change',
    }),
    (error) => error instanceof RegistryError && error.code === 'KNOWLEDGE_IDENTITY_CHANGED',
  );
});

test('audit time cannot move backwards', () => {
  let record = createKnowledgeRecord(createCommand({ at: T1 }));
  assert.throws(
    () => transitionKnowledgeRecord(record, transitionCommand(record, 'REVIEWING', T0)),
    (error) => error instanceof RegistryError && error.code === 'AUDIT_TIMESTAMP_REGRESSION',
  );
});

test('registry history validation rejects a broken status chain', () => {
  const record = createKnowledgeRecord(createCommand());
  const corrupted = structuredClone(record);
  corrupted.history[0].toStatus = 'PUBLISHED';
  assert.throws(
    () => replaceDraftRecord(corrupted, {
      expectedRevision: 1,
      knowledge: knowledge(),
      actor: 'quality-engineer',
      at: T1,
      reason: 'attempt update with corrupt history',
    }),
    (error) => error instanceof RegistryError && error.code === 'INVALID_REGISTRY_HISTORY',
  );
});
