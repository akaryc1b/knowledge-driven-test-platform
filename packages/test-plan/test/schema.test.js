import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION,
  TEST_INTENT_SCHEMA_VERSION,
  TEST_PLAN_SCHEMA_VERSION,
  TEST_PLANNING_REQUEST_SCHEMA_VERSION,
  TEST_TARGET_INVENTORY_SCHEMA_VERSION,
} from '../src/index.js';

const root = resolve(import.meta.dirname, '../../..');

test('planning schema catalog pins all core planning contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root, 'schemas/planning/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentPlanningRequest, TEST_PLANNING_REQUEST_SCHEMA_VERSION);
  assert.equal(catalog.currentTargetInventory, TEST_TARGET_INVENTORY_SCHEMA_VERSION);
  assert.equal(catalog.currentTestIntent, TEST_INTENT_SCHEMA_VERSION);
  assert.equal(catalog.currentCoverageObligation, TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION);
  assert.equal(catalog.currentTestPlan, TEST_PLAN_SCHEMA_VERSION);
  for (const path of Object.values(catalog.schemas)) {
    const schema = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});
