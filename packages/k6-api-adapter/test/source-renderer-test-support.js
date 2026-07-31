import assert from 'node:assert/strict';
import { renderK6ApiSource } from '../src/index.js';
export * from './p2-test-helpers.js';
export { K6_API_SOURCE_ALLOWED_MODULES, K6_API_SOURCE_LIMITS,
  computeK6ApiSourceResultDigest, createK6ApiSourceGeneratorDescriptor,
  renderK6ApiSource, validateK6ApiRenderedSource, validateK6ApiSourceResult,
} from '../src/index.js';

export function clone(value) {
  return structuredClone(value);
}

export function expectRejected(fn, pattern = null) {
  assert.throws(fn, pattern ?? /./);
}

export function validRendering(rendererBindings) {
  const input = rendererBindings();
  return { input, result: renderK6ApiSource(input) };
}
