export const EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION =
  'execution-adapter-descriptor/v1';
export const EXECUTION_REQUEST_SCHEMA_VERSION = 'execution-request/v1';
export const EXECUTION_FAILURE_SCHEMA_VERSION = 'execution-failure/v1';
export const EXECUTION_RESULT_SCHEMA_VERSION = 'execution-result/v1';
export const EXECUTION_EVIDENCE_SCHEMA_VERSION = 'execution-evidence/v1';

export const EXECUTION_ADAPTER_TYPES = Object.freeze([
  'k6-api',
  'k6-performance',
  'k6-browser',
  'k6-websocket',
  'xk6-extension',
]);

export const EXECUTION_IMPLEMENTATION_STATUSES = Object.freeze(['CONTRACT_ONLY']);
export const EXECUTION_CANCELLATION_MODES = Object.freeze(['COOPERATIVE', 'UNSUPPORTED']);

export const EXECUTION_STATES = Object.freeze([
  'PENDING',
  'VALIDATED',
  'REJECTED',
  'RUNNING',
  'CANCELLATION_REQUESTED',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
]);

export const EXECUTION_TERMINAL_STATES = Object.freeze([
  'REJECTED',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
]);

export const EXECUTION_RESULT_STATES = Object.freeze([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
]);

export const EXECUTION_FAILURE_CATEGORIES = Object.freeze([
  'VALIDATION',
  'AUTHORIZATION',
  'CAPABILITY_UNSUPPORTED',
  'INPUT_UNAVAILABLE',
  'ADAPTER_CONFIGURATION',
  'EXECUTION',
  'TIMEOUT',
  'INFRASTRUCTURE',
  'RESULT_VALIDATION',
  'INTERNAL',
]);
