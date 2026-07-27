import { randomUUID } from 'node:crypto';
import { SECURITY_HEADERS } from '@kdtp/governance-http';
import { SERVICE_HEALTH_SCHEMA_VERSION } from './readiness.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function createOperationalNodeHttpHandler({ businessHandler, readiness, requestIdFactory = randomUUID }) {
  if (typeof businessHandler !== 'function') throw new TypeError('businessHandler must be a function');
  if (!readiness || typeof readiness.live !== 'function' || typeof readiness.ready !== 'function') {
    throw new TypeError('readiness must expose live() and ready()');
  }
  return async function operationalNodeHttpHandler(request, response) {
    const pathname = parsePathname(request.url);
    if (pathname !== '/live' && pathname !== '/ready') return businessHandler(request, response);
    const requestId = resolveRequestId(request.headers?.['x-request-id'], requestIdFactory);
    try {
      if (request.method !== 'GET') {
        return writeJson(response, 405, errorBody(requestId, 'METHOD_NOT_ALLOWED', 'Operational endpoint only supports GET'), requestId, {
          allow: 'GET',
        });
      }
      if (new URL(request.url, 'http://service.local').search !== '') {
        return writeJson(response, 400, errorBody(requestId, 'INVALID_OPERATIONAL_QUERY', 'Operational endpoint does not accept query parameters'), requestId);
      }
      if (hasRequestBody(request.headers)) {
        request.resume?.();
        return writeJson(response, 413, errorBody(requestId, 'PAYLOAD_TOO_LARGE', 'Operational endpoint does not accept a request body'), requestId);
      }
      if (pathname === '/live') {
        return writeJson(response, 200, readiness.live(), requestId);
      }
      const result = await readiness.ready();
      return writeJson(response, result.statusCode, result.body, requestId);
    } catch {
      return writeJson(response, 500, errorBody(requestId, 'OPERATIONAL_INTERNAL_ERROR', 'Operational request could not be completed'), requestId);
    }
  };
}

export function healthResponse(status, service, checks = []) {
  return {
    schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
    service,
    status,
    uptimeSeconds: 0,
    checks,
  };
}

function parsePathname(input) {
  try { return new URL(input ?? '/', 'http://service.local').pathname; } catch { return ''; }
}

function resolveRequestId(value, factory) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string' && REQUEST_ID_PATTERN.test(candidate)) return candidate;
  const generated = factory();
  return typeof generated === 'string' && REQUEST_ID_PATTERN.test(generated) ? generated : randomUUID();
}

function hasRequestBody(headers = {}) {
  const contentLength = Number(Array.isArray(headers['content-length']) ? headers['content-length'][0] : headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > 0) return true;
  return headers['transfer-encoding'] !== undefined;
}

function errorBody(requestId, code, message) {
  return {
    schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
    requestId,
    error: { code, message },
  };
}

function writeJson(response, statusCode, body, requestId, extraHeaders = {}) {
  const payload = `${JSON.stringify(body)}\n`;
  response.statusCode = statusCode;
  for (const [name, value] of Object.entries({
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(payload)),
    'x-request-id': requestId,
    'cache-control': 'no-store',
    ...extraHeaders,
  })) response.setHeader(name, value);
  response.end(payload);
}
