export const K6_API_COMPILER_VERSION = '1.0.0';
export const K6_API_EXECUTION_SPEC_SCHEMA_VERSION = 'k6-api-execution-spec/v1';
export const K6_API_REQUEST_GROUP_SCHEMA_VERSION = 'k6-api-request-group/v1';
export const K6_API_OPERATION_SCHEMA_VERSION = 'k6-api-operation/v1';
export const K6_API_ASSERTION_SCHEMA_VERSION = 'k6-api-assertion/v1';
export const K6_API_THRESHOLD_SCHEMA_VERSION = 'k6-api-threshold/v1';
export const K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION = 'k6-api-artifact-bundle/v1';
export const K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION = 'k6-api-compilation-evidence/v1';

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
