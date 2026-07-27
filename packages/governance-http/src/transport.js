import { QUERY_RESPONSE_SCHEMA_VERSION } from '@kdtp/governance-query';
import {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_MAX_URL_LENGTH,
  SECURITY_HEADERS,
} from './constants.js';
import { assertAuthenticationPort } from './authentication-port.js';
import { HttpBoundaryError, httpInvariant } from './errors.js';
import { AllowAllReadOnlyRateLimiter, assertReadOnlyRateLimitPort } from './rate-limit-port.js';
import { matchReadOnlyRoute } from './router.js';
import {
  assertJsonAccept,
  assertReadOnlyBody,
  extractBearerCredential,
  normalizeHttpHeaders,
  rateLimitKey,
  resolveRequestId,
} from './request.js';

const HANDLER_METHODS = Object.freeze([
  'listKnowledge',
  'getKnowledge',
  'getReviewTimeline',
  'listSnapshots',
  'getSnapshot',
]);

export class ReadOnlyGovernanceHttpTransport {
  constructor(options) {
    this.handlers = assertHandlers(options?.handlers);
    this.authentication = assertAuthenticationPort(options?.authentication);
    this.rateLimiter = assertReadOnlyRateLimitPort(options?.rateLimiter ?? new AllowAllReadOnlyRateLimiter());
    this.maxBodyBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.maxUrlLength = options?.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH;
    this.clock = options?.clock ?? (() => Date.now());
    this.requestIdFactory = options?.requestIdFactory;
    httpInvariant(Number.isSafeInteger(this.maxBodyBytes) && this.maxBodyBytes >= 0,
      'INVALID_HTTP_CONFIG', 'maxBodyBytes must be a non-negative integer', 500);
    httpInvariant(Number.isSafeInteger(this.maxUrlLength) && this.maxUrlLength > 0,
      'INVALID_HTTP_CONFIG', 'maxUrlLength must be a positive integer', 500);
  }

  async dispatch(request) {
    let requestId = null;
    try {
      const headers = normalizeHttpHeaders(request?.headers ?? {});
      requestId = resolveRequestId(headers, this.requestIdFactory);
      assertJsonAccept(headers);
      assertReadOnlyBody(request?.body, this.maxBodyBytes);
      const route = matchReadOnlyRoute(request?.method ?? 'GET', request?.url, this.maxUrlLength);
      const bearer = extractBearerCredential(headers);
      const now = this.clock();
      const rate = await this.rateLimiter.consume({
        key: rateLimitKey(request?.remoteAddress, bearer.credential),
        now,
      });
      validateRateLimitResult(rate);
      if (!rate.allowed) {
        throw new HttpBoundaryError(
          'RATE_LIMITED',
          'Read-only request rate limit exceeded',
          429,
          {},
          rateHeaders(rate, true, now),
        );
      }
      const identity = await this.authentication.authenticate({
        ...bearer,
        requestId,
        remoteAddress: request?.remoteAddress ?? null,
      });
      validateIdentity(identity);
      const result = await this.handlers[route.handler]({
        context: { requestId, authenticatedIdentity: identity },
        projectId: route.projectId,
        params: route.params,
        query: route.query,
      });
      validateHandlerResult(result);
      return finalizeResponse(result.status, result.body, requestId, {
        ...rateHeaders(rate, false, now),
        ...(result.status === 401 ? { 'www-authenticate': 'Bearer' } : {}),
      });
    } catch (error) {
      return mapHttpBoundaryError(error, requestId);
    }
  }
}

export function mapHttpBoundaryError(error, requestId = null) {
  if (error instanceof HttpBoundaryError) {
    const internal = error.status >= 500;
    return finalizeResponse(error.status, {
      schemaVersion: QUERY_RESPONSE_SCHEMA_VERSION,
      requestId,
      error: {
        code: internal ? 'HTTP_INTERNAL_ERROR' : error.code,
        message: internal ? 'The read-only HTTP request could not be completed' : error.message,
      },
    }, requestId, internal ? {} : error.headers);
  }
  return finalizeResponse(500, {
    schemaVersion: QUERY_RESPONSE_SCHEMA_VERSION,
    requestId,
    error: {
      code: 'HTTP_INTERNAL_ERROR',
      message: 'The read-only HTTP request could not be completed',
    },
  }, requestId);
}

function finalizeResponse(status, body, requestId, headers = {}) {
  const payload = `${JSON.stringify(body)}\n`;
  return {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(payload)),
      'x-request-id': requestId ?? '',
      vary: 'Accept, Authorization',
      ...headers,
    },
    body,
    payload,
  };
}

function assertHandlers(handlers) {
  httpInvariant(handlers && typeof handlers === 'object',
    'INVALID_QUERY_HANDLERS', 'Read-only query handlers must be an object', 500);
  for (const method of HANDLER_METHODS) {
    httpInvariant(typeof handlers[method] === 'function',
      'INVALID_QUERY_HANDLERS', `Read-only query handlers are missing method ${method}`, 500, { method });
  }
  return handlers;
}

function validateIdentity(identity) {
  httpInvariant(identity && typeof identity === 'object' && !Array.isArray(identity),
    'INVALID_AUTHENTICATION_RESULT', 'Authentication port returned an invalid identity', 500);
  httpInvariant(typeof identity.actor === 'string' && identity.actor.trim().length > 0,
    'INVALID_AUTHENTICATION_RESULT', 'Authentication identity actor is invalid', 500);
}

function validateRateLimitResult(rate) {
  httpInvariant(rate && typeof rate === 'object' && typeof rate.allowed === 'boolean',
    'INVALID_RATE_LIMIT_RESULT', 'Rate limit port returned an invalid result', 500);
  if (rate.limit === null || rate.limit === undefined) return;
  httpInvariant(Number.isSafeInteger(rate.limit) && rate.limit > 0,
    'INVALID_RATE_LIMIT_RESULT', 'Rate limit result limit is invalid', 500);
  httpInvariant(Number.isSafeInteger(rate.remaining) && rate.remaining >= 0 && rate.remaining <= rate.limit,
    'INVALID_RATE_LIMIT_RESULT', 'Rate limit result remaining is invalid', 500);
  httpInvariant(Number.isFinite(rate.resetAt),
    'INVALID_RATE_LIMIT_RESULT', 'Rate limit result resetAt is invalid', 500);
}

function validateHandlerResult(result) {
  httpInvariant(result && typeof result === 'object' && Number.isSafeInteger(result.status) &&
      result.status >= 200 && result.status <= 599,
    'INVALID_QUERY_HANDLER_RESULT', 'Read-only query handler returned an invalid status', 500);
  httpInvariant(result.body && typeof result.body === 'object' && !Array.isArray(result.body),
    'INVALID_QUERY_HANDLER_RESULT', 'Read-only query handler returned an invalid body', 500);
}

function rateHeaders(rate, limited, now) {
  if (rate.limit === null || rate.limit === undefined) return {};
  const resetSeconds = Math.max(0, Math.ceil((rate.resetAt - now) / 1000));
  const headers = {
    'ratelimit-limit': String(rate.limit),
    'ratelimit-remaining': String(rate.remaining),
    'ratelimit-reset': String(Math.ceil(rate.resetAt / 1000)),
  };
  if (limited) headers['retry-after'] = String(resetSeconds);
  return headers;
}
