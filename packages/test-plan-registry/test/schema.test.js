import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION,
  TEST_PLAN_RECORD_SCHEMA_VERSION,
  TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('planning schema catalog includes durable Test Plan Registry contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root, 'schemas/planning/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentPlanRecord, TEST_PLAN_RECORD_SCHEMA_VERSION);
  assert.equal(catalog.currentPlanHistoryEvent, TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION);
  assert.equal(catalog.currentPlanReviewDecision, TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION);
  for (const version of [
    TEST_PLAN_RECORD_SCHEMA_VERSION,
    TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION,
    TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION,
  ]) {
    const schema = JSON.parse(await readFile(resolve(root, catalog.schemas[version]), 'utf8'));
    assert.equal(schema.properties.schemaVersion.const, version);
  }
});
