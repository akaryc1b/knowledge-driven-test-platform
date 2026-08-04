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

export const K6_API_SOURCE_STATIC_VALIDATOR_ID = 'k6-api-independent-static-validator';
export const K6_API_SOURCE_STATIC_VALIDATOR_VERSION = '1.0.0';
export const K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION = 'k6-api-source-artifact/v1';
export const K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION =
  'k6-api-source-validation-evidence/v1';
export const K6_API_SOURCE_ARTIFACT_KIND = 'k6-api-source';
export const K6_API_SOURCE_ARTIFACT_MEDIA_TYPE = 'application/javascript';

export const K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION =
  'k6-api-source-publication-bundle/v1';
export const K6_API_SOURCE_PUBLICATION_MANIFEST_SCHEMA_VERSION =
  'k6-api-source-publication-manifest/v1';
export const K6_API_SOURCE_PROVENANCE_SCHEMA_VERSION = 'k6-api-source-provenance/v1';
export const K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION =
  'k6-api-source-publication-receipt/v1';
export const K6_API_SOURCE_PUBLICATION_EVIDENCE_SCHEMA_VERSION =
  'k6-api-source-publication-evidence/v1';
export const K6_API_SOURCE_PUBLICATION_BUNDLE_KIND = 'k6-api-source-publication-bundle';
export const K6_API_SOURCE_PUBLICATION_FORMAT_VERSION = 'canonical-directory/v1';
export const K6_API_SOURCE_PUBLICATION_STORAGE_KIND =
  'CONTENT_ADDRESSED_FILESYSTEM';

export const K6_API_RUNTIME_POLICY_SCHEMA_VERSION = 'k6-api-runtime-policy/v1';
export const K6_API_RUNTIME_ADMISSION_REQUEST_SCHEMA_VERSION =
  'k6-api-runtime-admission-request/v1';
export const K6_API_INVOCATION_PLAN_SCHEMA_VERSION = 'k6-api-invocation-plan/v1';
export const K6_API_RUNTIME_ADMISSION_EVIDENCE_SCHEMA_VERSION =
  'k6-api-runtime-admission-evidence/v1';
export const K6_API_RUNTIME_ID = 'k6-api-runtime';
export const K6_API_RUNTIME_VERSION = '1.0.0';
export const K6_API_RUNTIME_IMPLEMENTATION_STATUS = 'ADMISSION_ONLY';
export const K6_API_RUNTIME_EXECUTION_MODE = 'LOCAL_PROCESS';
export const K6_API_RUNTIME_EXECUTABLE = 'k6';
export const K6_API_RUNTIME_SUBCOMMAND = 'run';
export const K6_API_RUNTIME_CANCELLATION_MODE = 'COOPERATIVE';
export const K6_API_RUNTIME_SOURCE_RELATIVE_PATH = 'source/main.js';
export const K6_API_RUNTIME_WORKING_DIRECTORY_MODE =
  'MATERIALIZED_IMMUTABLE_BUNDLE_ROOT';
export const K6_API_RUNTIME_ALLOWED_ENVIRONMENT_VARIABLE_NAMES = Object.freeze([
  'K6_LOG_FORMAT',
  'K6_NO_COLOR',
]);
export const K6_API_RUNTIME_ALLOWED_OUTPUT_ARTIFACT_KINDS = Object.freeze([
  'k6-run-summary-json',
]);
export const K6_API_RUNTIME_LIMITS = Object.freeze({
  maxVus: 50,
  maxIterations: 10_000,
  maxDurationMs: 900_000,
  maxGracefulStopMs: 30_000,
});

export const K6_LOCAL_PROCESS_PORT_SCHEMA_VERSION = 'k6-local-process-port/v1';
export const K6_PROCESS_LAUNCH_SPECIFICATION_SCHEMA_VERSION =
  'k6-process-launch-specification/v1';
export const K6_PROCESS_LAUNCH_DECISION_SCHEMA_VERSION =
  'k6-process-launch-decision/v1';
export const K6_PROCESS_BOUNDARY_EVIDENCE_SCHEMA_VERSION =
  'k6-process-boundary-evidence/v1';
export const K6_LOCAL_PROCESS_PORT_ID = 'k6-local-process-port';
export const K6_LOCAL_PROCESS_PORT_VERSION = '1.0.0';
export const K6_PROCESS_LOGICAL_WORKING_DIRECTORY = 'accepted-source-bundle-root';
export const K6_PROCESS_CAPTURE_MAX_BYTES = 65_536;
