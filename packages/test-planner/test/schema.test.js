import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  TEST_COVERAGE_MATRIX_SCHEMA_VERSION,
  TEST_DEPENDENCY_DAG_SCHEMA_VERSION,
  TEST_PLANNING_RESULT_SCHEMA_VERSION,
  TEST_PROVENANCE_GRAPH_SCHEMA_VERSION,
} from '../src/index.js';

const root = resolve(import.meta.dirname, '../../..');

test('planning schema catalog pins deterministic planner result contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root, 'schemas/planning/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentPlanningResult, TEST_PLANNING_RESULT_SCHEMA_VERSION);
  assert.equal(catalog.currentCoverageMatrix, TEST_COVERAGE_MATRIX_SCHEMA_VERSION);
  assert.equal(catalog.currentProvenanceGraph, TEST_PROVENANCE_GRAPH_SCHEMA_VERSION);
  assert.equal(catalog.currentDependencyDag, TEST_DEPENDENCY_DAG_SCHEMA_VERSION);
  for (const version of [
    TEST_PLANNING_RESULT_SCHEMA_VERSION,
    TEST_COVERAGE_MATRIX_SCHEMA_VERSION,
    TEST_PROVENANCE_GRAPH_SCHEMA_VERSION,
    TEST_DEPENDENCY_DAG_SCHEMA_VERSION,
  ]) {
    const schema = JSON.parse(await readFile(resolve(root, catalog.schemas[version]), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});
