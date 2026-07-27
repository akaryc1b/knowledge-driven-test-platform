export const DEFAULT_MAX_BODY_BYTES = 0;
export const DEFAULT_MAX_URL_LENGTH = 4096;
export const HTTP_TRANSPORT_SCHEMA_VERSION = 'governance-http-transport/v1';

export const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), geolocation=(), microphone=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

export const KNOWLEDGE_QUERY_PARAMETERS = Object.freeze([
  'status',
  'riskLevel',
  'id',
  'boundaryKey',
  'owner',
  'enabled',
  'search',
  'sortBy',
  'direction',
  'limit',
  'cursor',
]);

export const SNAPSHOT_QUERY_PARAMETERS = Object.freeze([
  'environmentId',
  'releaseId',
  'createdBy',
  'sortBy',
  'direction',
  'limit',
  'cursor',
]);
