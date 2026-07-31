import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson } from '@kdtp/execution-contract';
import { K6_API_SOURCE_RESULT_SCHEMA_VERSION } from './constants.js';
import { sourceRendererInvariant } from './errors.js';
import { renderSourceDocument } from './source-renderer-document.js';
import { validateRendererInput } from './source-renderer-input.js';
import {
  RESULT_FIELDS,
  SAFETY_BOUNDARY,
  countLines,
  deepFreeze,
  exactFields,
  sha256Utf8,
} from './source-renderer-shared.js';
import { validateRenderedSourceText } from './source-renderer-static.js';

export function renderK6ApiSource(input) {
  const context = validateRendererInput(input);
  const source = renderSourceDocument(context);
  validateRenderedSourceText(source, context);
  const resultWithoutDigest = {
    schemaVersion: K6_API_SOURCE_RESULT_SCHEMA_VERSION,
    sourceIdentity: cloneExecutionJson(context.generationRequest.sourceIdentity),
    generationRequestDigest: context.generationRequest.requestDigest,
    renderingPolicyDigest: context.descriptor.renderingPolicy.policyDigest,
    generatorDescriptorDigest: context.descriptor.descriptorDigest,
    specDigest: context.spec.specDigest,
    bundleDigest: context.bundle.bundleDigest,
    compilationEvidenceDigest: context.compilationEvidence.evidenceDigest,
    sourceDigest: sha256Utf8(source),
    sourceByteLength: Buffer.byteLength(source, 'utf8'),
    sourceLineCount: countLines(source),
    moduleImports: [...context.moduleImports],
    operationCount: context.operations.length,
    assertionCount: context.assertionCount,
    thresholdCount: context.thresholdCount,
    safetyBoundary: { ...SAFETY_BOUNDARY },
    source,
  };
  return deepFreeze(cloneExecutionJson({
    ...resultWithoutDigest,
    resultDigest: sha256(resultWithoutDigest),
  }));
}

export function validateK6ApiRenderedSource(source, input) {
  const context = validateRendererInput(input);
  validateRenderedSourceText(source, context);
  sourceRendererInvariant(source === renderSourceDocument(context),
    'K6_API_SOURCE_NON_CANONICAL',
    'Rendered source is not the exact canonical output for its immutable inputs');
  return true;
}

export function validateK6ApiSourceResult(result, input) {
  exactFields(result, RESULT_FIELDS, 'INVALID_K6_API_SOURCE_RESULT', 'Source Result');
  const expected = renderK6ApiSource(input);
  sourceRendererInvariant(canonicalStringify(result) === canonicalStringify(expected),
    'K6_API_SOURCE_RESULT_MISMATCH',
    'Source Result does not match the canonical rendering and immutable input chain');
  return expected;
}

export function computeK6ApiSourceResultDigest(result) {
  exactFields(result, RESULT_FIELDS, 'INVALID_K6_API_SOURCE_RESULT', 'Source Result');
  const { resultDigest: _resultDigest, ...withoutDigest } = result;
  return sha256(withoutDigest);
}
