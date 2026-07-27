import test from 'node:test';
import assert from 'node:assert/strict';
import { RegistryError } from '../src/index.js';
import { createCommand, knowledge, T0, T1, T2, T3, T4, transitionCommand } from './test-helpers.js';

/**
 * Shared contract for every KnowledgeRegistryPort adapter.
 *
 * @param {string} adapterName
 * @param {() => import('../src/registry-port.js').KnowledgeRegistryPort | Promise<import('../src/registry-port.js').KnowledgeRegistryPort>} createRegistry
 * @param {{beforeEach?: () => Promise<void> | void, afterEach?: (registry: import('../src/registry-port.js').KnowledgeRegistryPort) => Promise<void> | void}} [hooks]
 */
export function defineKnowledgeRegistryContractTests(adapterName, createRegistry, hooks = {}) {
  const adapterTest = (name, body) => test(`${adapterName}: ${name}`, { concurrency: false }, async () => {
    await hooks.beforeEach?.();
    const registry = await createRegistry();
    try {
      await body(registry);
    } finally {
      await hooks.afterEach?.(registry);
    }
  });
  adapterTest(`creates and retrieves a defensive copy`, async (registry) => {
    const created = await registry.createDraft(createCommand());
    created.knowledge.value.expected = false;

    const stored = await registry.get({ id: 'PROJECT-SAMPLE-001', version: '1.0.0' });
    assert.equal(stored.revision, 1);
    assert.deepEqual(stored.knowledge.value, { expected: true });
    assert.equal(stored.history.length, 1);
  });

  adapterTest(`rejects duplicate id and version`, async (registry) => {
    await registry.createDraft(createCommand());
    await assert.rejects(
      () => registry.createDraft(createCommand({ at: T1 })),
      (error) => error instanceof RegistryError && error.code === 'KNOWLEDGE_VERSION_EXISTS',
    );
  });

  adapterTest(`concurrent duplicate creation has one winner`, async (registry) => {
    const results = await Promise.allSettled([
      registry.createDraft(createCommand()),
      registry.createDraft(createCommand({ at: T1 })),
    ]);

    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    const rejected = results.find((item) => item.status === 'rejected');
    assert.equal(rejected.reason.code, 'KNOWLEDGE_VERSION_EXISTS');
  });

  adapterTest(`requires monotonically increasing versions`, async (registry) => {
    await registry.createDraft(createCommand({
      knowledge: knowledge({ version: '2.0.0' }),
    }));

    await assert.rejects(
      () => registry.createDraft(createCommand({
        at: T1,
        knowledge: knowledge({ version: '1.9.9' }),
      })),
      (error) => error instanceof RegistryError && error.code === 'NON_MONOTONIC_VERSION',
    );
  });

  adapterTest(`replaces draft using revision CAS`, async (registry) => {
    const created = await registry.createDraft(createCommand());
    const updated = await registry.replaceDraft({
      id: created.knowledge.id,
      version: created.knowledge.version,
      expectedRevision: created.revision,
      knowledge: knowledge({ value: { expected: true, timeoutMs: 5000 } }),
      actor: 'quality-engineer',
      at: T1,
      reason: 'add timeout boundary',
    });

    assert.equal(updated.revision, 2);
    assert.deepEqual(updated.knowledge.value, { expected: true, timeoutMs: 5000 });
    assert.equal(updated.history.at(-1).type, 'DRAFT_REPLACED');
  });

  adapterTest(`rejects stale revision`, async (registry) => {
    const created = await registry.createDraft(createCommand());
    await registry.replaceDraft({
      id: created.knowledge.id,
      version: created.knowledge.version,
      expectedRevision: 1,
      knowledge: knowledge({ name: 'Updated name' }),
      actor: 'quality-engineer',
      at: T1,
      reason: 'first update',
    });

    await assert.rejects(
      () => registry.replaceDraft({
        id: created.knowledge.id,
        version: created.knowledge.version,
        expectedRevision: 1,
        knowledge: knowledge({ name: 'Stale update' }),
        actor: 'quality-engineer',
        at: T2,
        reason: 'stale update',
      }),
      (error) => error instanceof RegistryError && error.code === 'REVISION_CONFLICT',
    );
  });

  adapterTest(`supports the governed publication lifecycle`, async (registry) => {
    let record = await registry.createDraft(createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    record = await registry.transition(transitionCommand(record, 'PUBLISHED', T2));

    const latest = await registry.getLatestPublished({ id: record.knowledge.id });
    assert.equal(latest.knowledge.status, 'PUBLISHED');

    record = await registry.transition(transitionCommand(record, 'DEPRECATED', T3));
    record = await registry.transition(transitionCommand(record, 'ARCHIVED', T4));
    assert.equal(record.knowledge.status, 'ARCHIVED');
    assert.equal(record.revision, 5);
  });

  adapterTest(`published content cannot be replaced`, async (registry) => {
    let record = await registry.createDraft(createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    record = await registry.transition(transitionCommand(record, 'PUBLISHED', T2));

    await assert.rejects(
      () => registry.replaceDraft({
        id: record.knowledge.id,
        version: record.knowledge.version,
        expectedRevision: record.revision,
        knowledge: knowledge({ status: 'DRAFT', value: { modified: true } }),
        actor: 'quality-engineer',
        at: T3,
        reason: 'attempt to mutate published knowledge',
      }),
      (error) => error instanceof RegistryError && error.code === 'KNOWLEDGE_NOT_EDITABLE',
    );
  });

  adapterTest(`rejects invalid list filters`, async (registry) => {
    await assert.rejects(
      () => registry.list({ status: 'UNKNOWN' }),
      (error) => error instanceof RegistryError && error.code === 'INVALID_REGISTRY_FILTER',
    );
  });

  adapterTest(`lists records in stable identity and version order`, async (registry) => {
    await registry.createDraft(createCommand({
      knowledge: knowledge({ id: 'PROJECT-ZETA-001', version: '1.0.0' }),
    }));
    await registry.createDraft(createCommand({
      at: T1,
      knowledge: knowledge({ id: 'PROJECT-ALPHA-001', version: '1.0.0' }),
    }));
    await registry.createDraft(createCommand({
      at: T2,
      knowledge: knowledge({ id: 'PROJECT-ALPHA-001', version: '1.1.0' }),
    }));

    const records = await registry.list({ scopeLevel: 'PROJECT', scopeKey: 'approval-platform' });
    assert.deepEqual(records.map((item) => `${item.knowledge.id}@${item.knowledge.version}`), [
      'PROJECT-ALPHA-001@1.0.0',
      'PROJECT-ALPHA-001@1.1.0',
      'PROJECT-ZETA-001@1.0.0',
    ]);
  });
}
