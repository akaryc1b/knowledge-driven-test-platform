import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLAN_QUERY_PAGE_SCHEMA_VERSION,
  PLAN_QUERY_RESPONSE_SCHEMA_VERSION,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('query schema catalog includes Test Plan response and page contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root, 'schemas/query/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentPlanResponseEnvelope, PLAN_QUERY_RESPONSE_SCHEMA_VERSION);
  assert.equal(catalog.currentPlanPage, PLAN_QUERY_PAGE_SCHEMA_VERSION);
  for (const version of [PLAN_QUERY_RESPONSE_SCHEMA_VERSION, PLAN_QUERY_PAGE_SCHEMA_VERSION]) {
    const entry = catalog.schemas.find((item) => item.schemaVersion === version);
    assert.ok(entry);
    const schema = JSON.parse(await readFile(resolve(root, entry.path), 'utf8'));
    assert.equal(schema.properties.schemaVersion.const, version);
  }
});
