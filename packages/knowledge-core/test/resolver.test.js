import test from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeError, resolveKnowledge } from '../src/index.js';
import { context, rule } from './test-helpers.js';

function input(overrides = {}) {
  return {
    context: context(),
    layers: {
      global: [],
      domains: [],
      project: [],
      environment: [],
      release: [],
      ...overrides,
    },
  };
}

test('resolves allowed overrides by scope precedence', () => {
  const result = resolveKnowledge(input({
    global: [rule({ id: 'G1', value: { timeoutMs: 10000 } })],
    project: [rule({
      id: 'P1',
      level: 'PROJECT',
      key: 'approval-platform',
      value: { timeoutMs: 5000 },
    })],
  }));

  assert.equal(result.rules[0].id, 'P1');
  assert.deepEqual(result.rules[0].value, { timeoutMs: 5000 });
  assert.deepEqual(result.resolution[0].chain.map((entry) => entry.action), ['BASE', 'OVERRIDE']);
});

test('deny policy rejects an effective change', () => {
  assert.throws(
    () => resolveKnowledge(input({
      global: [rule({
        id: 'G1',
        enforcement: 'mandatory',
        overridePolicy: 'deny',
        value: { redactSecrets: true },
      })],
      project: [rule({
        id: 'P1',
        level: 'PROJECT',
        key: 'approval-platform',
        value: { redactSecrets: false },
      })],
    })),
    (error) => error instanceof KnowledgeError && error.code === 'OVERRIDE_DENIED',
  );
});

test('mandatory rule cannot be disabled', () => {
  assert.throws(
    () => resolveKnowledge(input({
      global: [rule({ id: 'G1', enforcement: 'mandatory', enabled: true })],
      project: [rule({
        id: 'P1',
        level: 'PROJECT',
        key: 'approval-platform',
        enabled: false,
      })],
    })),
    (error) => error instanceof KnowledgeError && error.code === 'MANDATORY_RULE_DISABLED',
  );
});

test('strengthen policy deep-merges and retains stronger governance metadata', () => {
  const result = resolveKnowledge(input({
    domains: [{
      id: 'approval-workflow',
      rules: [rule({
        id: 'D1',
        level: 'DOMAIN',
        key: 'approval-workflow',
        enforcement: 'mandatory',
        overridePolicy: 'strengthen',
        value: { requireActiveTask: true },
      })],
    }],
    project: [rule({
      id: 'P1',
      level: 'PROJECT',
      key: 'approval-platform',
      overrideIntent: 'strengthen',
      value: { requireCas: true },
    })],
  }));

  assert.deepEqual(result.rules[0].value, {
    requireActiveTask: true,
    requireCas: true,
  });
  assert.equal(result.rules[0].enforcement, 'mandatory');
  assert.equal(result.rules[0].overridePolicy, 'strengthen');
});

test('strengthen policy requires explicit intent', () => {
  assert.throws(
    () => resolveKnowledge(input({
      domains: [{
        id: 'approval-workflow',
        rules: [rule({
          id: 'D1',
          level: 'DOMAIN',
          key: 'approval-workflow',
          overridePolicy: 'strengthen',
        })],
      }],
      project: [rule({
        id: 'P1',
        level: 'PROJECT',
        key: 'approval-platform',
      })],
    })),
    (error) => error instanceof KnowledgeError && error.code === 'STRENGTHEN_INTENT_REQUIRED',
  );
});

test('same-precedence boundary conflict is rejected', () => {
  assert.throws(
    () => resolveKnowledge(input({
      global: [rule({ id: 'G1' }), rule({ id: 'G2' })],
    })),
    (error) => error instanceof KnowledgeError && error.code === 'SAME_LAYER_CONFLICT',
  );
});

test('project scope must match the execution context', () => {
  assert.throws(
    () => resolveKnowledge(input({
      project: [rule({ id: 'P1', level: 'PROJECT', key: 'other-project' })],
    })),
    (error) => error instanceof KnowledgeError && error.code === 'SCOPE_MISMATCH',
  );
});
