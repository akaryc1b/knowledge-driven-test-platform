import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CAPABILITY_CATALOG_SCHEMA_VERSION,
  TEST_CAPABILITY_SCHEMA_VERSION,
} from '../src/index.js';

const root = resolve(import.meta.dirname, '../../..');

test('capability schema catalog pins current contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root, 'schemas/capability/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentCapability, TEST_CAPABILITY_SCHEMA_VERSION);
  assert.equal(catalog.currentCapabilityCatalog, CAPABILITY_CATALOG_SCHEMA_VERSION);
  for (const path of Object.values(catalog.schemas)) {
    const schema = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});
