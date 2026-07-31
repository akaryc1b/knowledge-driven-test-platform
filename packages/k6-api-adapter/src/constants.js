export const K6_API_COMPILER_VERSION = '1.0.0';
export const K6_API_EXECUTION_SPEC_SCHEMA_VERSION = 'k6-api-execution-spec/v1';
export const K6_API_REQUEST_GROUP_SCHEMA_VERSION = 'k6-api-request-group/v1';
export const K6_API_OPERATION_SCHEMA_VERSION = 'k6-api-operation/v1';
export const K6_API_ASSERTION_SCHEMA_VERSION = 'k6-api-assertion/v1';
export const K6_API_THRESHOLD_SCHEMA_VERSION = 'k6-api-threshold/v1';
export const K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION = 'k6-api-artifact-bundle/v1';
export const K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION = 'k6-api-compilation-evidence/v1';

export const K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION =
  'k6-api-source-rendering-policy/v1';
export const K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION =
  'k6-api-source-generator-descriptor/v1';
export const K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION =
  'k6-api-source-generation-request/v1';
export const K6_API_SOURCE_GENERATOR_ID = 'k6-api-deterministic-source';
export const K6_API_SOURCE_GENERATOR_VERSION = '1.0.0';
export const K6_API_SOURCE_FORMAT_VERSION = 'k6-javascript-esm/v1';
export const K6_API_SOURCE_IMPLEMENTATION_STATUS = 'CONTRACT_ONLY';

export const K6_API_HTTP_METHODS = Object.freeze([
  'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]);
export const K6_API_ASSERTION_KINDS = Object.freeze([
  'STATUS_CODE_IN', 'JSON_PATH_EXISTS', 'JSON_PATH_EQUALS',
]);
export const K6_API_THRESHOLD_METRICS = Object.freeze([
  'HTTP_REQUEST_DURATION_MS', 'CHECK_FAILURE_RATE', 'CHECK_SUCCESS_RATE',
]);
export const K6_API_REQUIRED_OUTPUT_ARTIFACT_KINDS = Object.freeze([
  'k6-api-execution-spec',
  'k6-api-artifact-bundle',
  'k6-api-compilation-evidence',
]);

export const K6_API_SOURCE_ALLOWED_MODULES = Object.freeze(['k6', 'k6/http']);
export const K6_API_SOURCE_UNORDERED_SET_FIELDS = Object.freeze([
  'allowedModules',
  'capabilities',
  'sourceIntentIds',
]);
export const K6_API_SOURCE_IDENTITY_EXCLUDED_FIELDS = Object.freeze([
  'artifactId',
  'ciRunId',
  'generatedAt',
  'host',
  'operatingSystem',
  'prNumber',
  'requestedAt',
  'requestedBy',
  'workingDirectory',
]);
export const K6_API_SOURCE_LIMITS = Object.freeze({
  maxSerializedSpecBytes: 16_000_000,
  maxRequestGroups: 1_000,
  maxOperations: 10_000,
  maxAssertionsPerOperation: 128,
  maxThresholdsPerOperation: 32,
  maxArtifactManifestEntries: 10_000,
  maxStringBytes: 8_192,
  maxNestingDepth: 32,
});

export const K6_API_SOURCE_RESULT_SCHEMA_VERSION = 'k6-api-source-result/v1';
