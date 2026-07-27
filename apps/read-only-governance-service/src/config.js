import { serviceInvariant } from './errors.js';

const HOST_PATTERN = /^(?:0\.0\.0\.0|127\.0\.0\.1|::|localhost|[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)$/;
const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const ACTOR_PATTERN = /^[\p{L}\p{N}._:@/-]{1,256}$/u;
const MAX_MAPPING_BYTES = 64 * 1024;

export function loadServiceConfig(env = process.env) {
  serviceInvariant(env && typeof env === 'object',
    'INVALID_SERVICE_ENVIRONMENT', 'Service environment must be an object');
  const serviceName = optionalString(env.KDTP_SERVICE_NAME, 'kdtp-read-only-governance');
  serviceInvariant(NAME_PATTERN.test(serviceName),
    'INVALID_SERVICE_CONFIG', 'KDTP_SERVICE_NAME is invalid');
  const databaseUrl = requiredString(env.KDTP_DATABASE_URL, 'KDTP_DATABASE_URL');
  validateDatabaseUrl(databaseUrl);
  const issuer = validateHttpsUrl(requiredString(env.KDTP_OIDC_ISSUER, 'KDTP_OIDC_ISSUER'), 'KDTP_OIDC_ISSUER', true);
  const jwksUri = validateHttpsUrl(requiredString(env.KDTP_OIDC_JWKS_URI, 'KDTP_OIDC_JWKS_URI'), 'KDTP_OIDC_JWKS_URI', false);
  const audiences = parseList(requiredString(env.KDTP_OIDC_AUDIENCE, 'KDTP_OIDC_AUDIENCE'), 'KDTP_OIDC_AUDIENCE', 16, 256);
  const subjectMappings = parseSubjectMappings(
    requiredString(env.KDTP_OIDC_SUBJECT_MAPPINGS_JSON, 'KDTP_OIDC_SUBJECT_MAPPINGS_JSON'),
    issuer,
  );

  return deepFreeze({
    serviceName,
    http: {
      host: validateHost(optionalString(env.KDTP_HTTP_HOST, '0.0.0.0')),
      port: integer(env.KDTP_HTTP_PORT, 8080, 1, 65535, 'KDTP_HTTP_PORT'),
      maxBodyBytes: integer(env.KDTP_HTTP_MAX_BODY_BYTES, 0, 0, 1024, 'KDTP_HTTP_MAX_BODY_BYTES'),
      maxUrlLength: integer(env.KDTP_HTTP_MAX_URL_LENGTH, 4096, 256, 16384, 'KDTP_HTTP_MAX_URL_LENGTH'),
      requestTimeoutMs: integer(env.KDTP_HTTP_REQUEST_TIMEOUT_MS, 15_000, 1000, 120_000, 'KDTP_HTTP_REQUEST_TIMEOUT_MS'),
      headersTimeoutMs: integer(env.KDTP_HTTP_HEADERS_TIMEOUT_MS, 10_000, 1000, 120_000, 'KDTP_HTTP_HEADERS_TIMEOUT_MS'),
      keepAliveTimeoutMs: integer(env.KDTP_HTTP_KEEP_ALIVE_TIMEOUT_MS, 5_000, 1000, 60_000, 'KDTP_HTTP_KEEP_ALIVE_TIMEOUT_MS'),
    },
    database: {
      url: databaseUrl,
      maxPoolSize: integer(env.KDTP_PG_MAX_POOL_SIZE, 10, 1, 100, 'KDTP_PG_MAX_POOL_SIZE'),
      connectionTimeoutMs: integer(env.KDTP_PG_CONNECTION_TIMEOUT_MS, 5_000, 500, 60_000, 'KDTP_PG_CONNECTION_TIMEOUT_MS'),
      idleTimeoutMs: integer(env.KDTP_PG_IDLE_TIMEOUT_MS, 30_000, 1000, 300_000, 'KDTP_PG_IDLE_TIMEOUT_MS'),
    },
    oidc: {
      issuer,
      jwksUri,
      audiences,
      subjectMappings,
      clockSkewSeconds: integer(env.KDTP_OIDC_CLOCK_SKEW_SECONDS, 60, 0, 300, 'KDTP_OIDC_CLOCK_SKEW_SECONDS'),
      maxTokenAgeSeconds: nullableInteger(env.KDTP_OIDC_MAX_TOKEN_AGE_SECONDS, null, 1, 86_400, 'KDTP_OIDC_MAX_TOKEN_AGE_SECONDS'),
      jwksTimeoutMs: integer(env.KDTP_OIDC_JWKS_TIMEOUT_MS, 3_000, 250, 30_000, 'KDTP_OIDC_JWKS_TIMEOUT_MS'),
      jwksCacheTtlMs: integer(env.KDTP_OIDC_JWKS_CACHE_TTL_MS, 300_000, 1000, 86_400_000, 'KDTP_OIDC_JWKS_CACHE_TTL_MS'),
      jwksMaxCacheTtlMs: integer(env.KDTP_OIDC_JWKS_MAX_CACHE_TTL_MS, 3_600_000, 1000, 86_400_000, 'KDTP_OIDC_JWKS_MAX_CACHE_TTL_MS'),
    },
    rateLimit: {
      limit: integer(env.KDTP_RATE_LIMIT_MAX_REQUESTS, 120, 1, 100_000, 'KDTP_RATE_LIMIT_MAX_REQUESTS'),
      windowMs: integer(env.KDTP_RATE_LIMIT_WINDOW_MS, 60_000, 1000, 3_600_000, 'KDTP_RATE_LIMIT_WINDOW_MS'),
      maxEntries: integer(env.KDTP_RATE_LIMIT_MAX_ENTRIES, 10_000, 100, 1_000_000, 'KDTP_RATE_LIMIT_MAX_ENTRIES'),
    },
    operations: {
      readinessTimeoutMs: integer(env.KDTP_READINESS_TIMEOUT_MS, 3_000, 100, 30_000, 'KDTP_READINESS_TIMEOUT_MS'),
      shutdownTimeoutMs: integer(env.KDTP_SHUTDOWN_TIMEOUT_MS, 10_000, 1000, 120_000, 'KDTP_SHUTDOWN_TIMEOUT_MS'),
    },
  });
}

export function publicServiceConfig(config) {
  return {
    serviceName: config.serviceName,
    http: { host: config.http.host, port: config.http.port },
    database: { maxPoolSize: config.database.maxPoolSize },
    oidc: { issuer: config.oidc.issuer, audiences: [...config.oidc.audiences] },
    rateLimit: structuredClone(config.rateLimit),
    operations: structuredClone(config.operations),
  };
}

function requiredString(value, field) {
  serviceInvariant(typeof value === 'string' && value.trim().length > 0,
    'MISSING_SERVICE_CONFIG', `${field} is required`, { field });
  return value.trim();
}

function optionalString(value, fallback) {
  return value === undefined || value === null || String(value).trim() === '' ? fallback : String(value).trim();
}

function integer(value, fallback, minimum, maximum, field) {
  const normalized = value === undefined || value === null || value === '' ? fallback : Number(value);
  serviceInvariant(Number.isSafeInteger(normalized) && normalized >= minimum && normalized <= maximum,
    'INVALID_SERVICE_CONFIG', `${field} must be between ${minimum} and ${maximum}`, { field });
  return normalized;
}

function nullableInteger(value, fallback, minimum, maximum, field) {
  if (value === undefined || value === null || value === '') return fallback;
  return integer(value, fallback, minimum, maximum, field);
}

function validateDatabaseUrl(input) {
  let url;
  try { url = new URL(input); } catch { url = null; }
  serviceInvariant(url && ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname.length > 0,
    'INVALID_SERVICE_CONFIG', 'KDTP_DATABASE_URL must be a PostgreSQL URL');
}

function validateHttpsUrl(input, field, forbidQuery) {
  let url;
  try { url = new URL(input); } catch { url = null; }
  serviceInvariant(url && url.protocol === 'https:' && url.username === '' && url.password === '' &&
    url.hash === '' && (!forbidQuery || url.search === ''),
  'INVALID_SERVICE_CONFIG', `${field} must be an HTTPS URL`, { field });
  return input;
}

function validateHost(input) {
  serviceInvariant(HOST_PATTERN.test(input),
    'INVALID_SERVICE_CONFIG', 'KDTP_HTTP_HOST is invalid');
  return input;
}

function parseList(input, field, maximumItems, maximumLength) {
  const values = input.split(',').map((value) => value.trim()).filter(Boolean);
  serviceInvariant(values.length > 0 && values.length <= maximumItems &&
    values.every((value) => value.length <= maximumLength) && new Set(values).size === values.length,
  'INVALID_SERVICE_CONFIG', `${field} must contain unique comma-separated values`, { field });
  return values;
}

function parseSubjectMappings(input, issuer) {
  serviceInvariant(Buffer.byteLength(input, 'utf8') <= MAX_MAPPING_BYTES,
    'INVALID_SERVICE_CONFIG', 'KDTP_OIDC_SUBJECT_MAPPINGS_JSON is too large');
  let value;
  try { value = JSON.parse(input); } catch { value = null; }
  serviceInvariant(Array.isArray(value) && value.length > 0 && value.length <= 10_000,
    'INVALID_SERVICE_CONFIG', 'KDTP_OIDC_SUBJECT_MAPPINGS_JSON must be a non-empty array');
  const subjects = new Set();
  return value.map((entry, index) => {
    serviceInvariant(entry && typeof entry === 'object' && !Array.isArray(entry),
      'INVALID_SERVICE_CONFIG', 'OIDC subject mapping entry is invalid', { index });
    const subject = entry.subject;
    const actor = entry.actor;
    serviceInvariant(typeof subject === 'string' && subject.length > 0 && subject.length <= 512 && !subjects.has(subject),
      'INVALID_SERVICE_CONFIG', 'OIDC subject mapping subject is invalid or duplicated', { index });
    serviceInvariant(typeof actor === 'string' && ACTOR_PATTERN.test(actor),
      'INVALID_SERVICE_CONFIG', 'OIDC subject mapping actor is invalid', { index });
    serviceInvariant(entry.attributes === undefined ||
      (entry.attributes && typeof entry.attributes === 'object' && !Array.isArray(entry.attributes)),
    'INVALID_SERVICE_CONFIG', 'OIDC subject mapping attributes must be an object', { index });
    subjects.add(subject);
    return {
      issuer,
      subject,
      actor,
      disabled: entry.disabled === true,
      attributes: structuredClone(entry.attributes ?? {}),
    };
  });
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
