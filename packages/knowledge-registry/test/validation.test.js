import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareKnowledgeVersions,
  knowledgeKey,
  RegistryError,
  validateKnowledgeObject,
} from '../src/index.js';
import { knowledge } from './test-helpers.js';

const here = dirname(fileURLToPath(import.meta.url));

test('versioned JSON Schema publishes the knowledge-rule/v1 contract', async () => {
  const path = resolve(here, '../../../schemas/knowledge/v1/knowledge-rule.schema.json');
  const schema = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schemaVersion.const, 'knowledge-rule/v1');
  assert.ok(schema.required.includes('id'));
  assert.ok(schema.required.includes('version'));
});

test('versioned registry record schema is published', async () => {
  const path = resolve(here, '../../../schemas/registry/v1/knowledge-registry-record.schema.json');
  const schema = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(schema.properties.recordSchemaVersion.const, 'knowledge-registry-record/v1');
  assert.equal(schema.properties.knowledge.$ref, '../../knowledge/v1/knowledge-rule.schema.json');
});

test('validates and normalizes a v1 knowledge object', () => {
  const normalized = validateKnowledgeObject(knowledge());
  assert.equal(normalized.schemaVersion, 'knowledge-rule/v1');
  assert.equal(normalized.mergeStrategy, 'replace');
});

test('rejects unsupported schema versions', () => {
  assert.throws(
    () => validateKnowledgeObject(knowledge({ schemaVersion: 'knowledge-rule/v2' })),
    (error) => error instanceof RegistryError && error.code === 'UNSUPPORTED_SCHEMA_VERSION',
  );
});

test('rejects invalid identity and version forms', () => {
  assert.throws(
    () => knowledgeKey('project-sample-001', '1.0.0'),
    (error) => error instanceof RegistryError && error.code === 'INVALID_KNOWLEDGE_ID',
  );
  assert.throws(
    () => knowledgeKey('PROJECT-SAMPLE-001', '1.0.0-beta.1'),
    (error) => error instanceof RegistryError && error.code === 'INVALID_KNOWLEDGE_VERSION',
  );
});

test('rejects versions outside the safe integer range', () => {
  assert.throws(
    () => knowledgeKey('PROJECT-SAMPLE-001', '999999999999999999999.0.0'),
    (error) => error instanceof RegistryError && error.code === 'INVALID_KNOWLEDGE_VERSION',
  );
});

test('compares strict semantic versions numerically', () => {
  assert.equal(compareKnowledgeVersions('1.10.0', '1.2.9'), 8);
  assert.ok(compareKnowledgeVersions('2.0.0', '1.99.99') > 0);
});

test('rejects fields outside the versioned schema', () => {
  assert.throws(
    () => validateKnowledgeObject(knowledge({ unexpected: true })),
    (error) => error instanceof RegistryError && error.code === 'UNKNOWN_KNOWLEDGE_FIELD',
  );
});

test('rejects duplicate tags declared unique by the schema', () => {
  assert.throws(
    () => validateKnowledgeObject(knowledge({ tags: ['security', 'security'] })),
    (error) => error instanceof RegistryError && error.code === 'DUPLICATE_TAG',
  );
});


test('registry port shape rejects incomplete adapters', async () => {
  const { assertKnowledgeRegistryPort } = await import('../src/index.js');
  assert.throws(
    () => assertKnowledgeRegistryPort({ createDraft() {} }),
    (error) => error instanceof RegistryError && error.code === 'INVALID_REGISTRY_PORT',
  );
});
