import { HttpBoundaryError, httpInvariant } from '@kdtp/governance-http';
import {
  DEFAULT_JWKS_CACHE_TTL_MS,
  DEFAULT_JWKS_MAX_CACHE_TTL_MS,
  DEFAULT_JWKS_MAX_KEYS,
  DEFAULT_JWKS_MAX_RESPONSE_BYTES,
  DEFAULT_JWKS_MIN_REFRESH_INTERVAL_MS,
  DEFAULT_JWKS_TIMEOUT_MS,
} from './constants.js';
import { authenticationUnavailable, unauthenticated } from './errors.js';
import { AuthenticationEventSinkPort, JwksProviderPort, assertAuthenticationEventSinkPort } from './ports.js';
import { createAuthenticationEvent } from './telemetry.js';

export class RemoteJwksProvider extends JwksProviderPort {
  constructor(options) {
    super();
    this.issuer = validateHttpsUrl(options?.issuer, 'issuer', options?.allowHttpForTesting === true);
    this.jwksUri = validateHttpsUrl(options?.jwksUri, 'jwksUri', options?.allowHttpForTesting === true);
    this.fetcher = options?.fetcher ?? globalThis.fetch;
    httpInvariant(typeof this.fetcher === 'function',
      'INVALID_OIDC_CONFIG', 'JWKS fetcher must be a function', 500);
    this.clock = options?.clock ?? (() => Date.now());
    this.cacheTtlMs = positiveInteger(options?.cacheTtlMs ?? DEFAULT_JWKS_CACHE_TTL_MS, 'cacheTtlMs');
    this.maxCacheTtlMs = positiveInteger(options?.maxCacheTtlMs ?? DEFAULT_JWKS_MAX_CACHE_TTL_MS, 'maxCacheTtlMs');
    this.minimumRefreshIntervalMs = nonNegativeInteger(
      options?.minimumRefreshIntervalMs ?? DEFAULT_JWKS_MIN_REFRESH_INTERVAL_MS,
      'minimumRefreshIntervalMs',
    );
    this.timeoutMs = positiveInteger(options?.timeoutMs ?? DEFAULT_JWKS_TIMEOUT_MS, 'timeoutMs');
    this.maxResponseBytes = positiveInteger(
      options?.maxResponseBytes ?? DEFAULT_JWKS_MAX_RESPONSE_BYTES,
      'maxResponseBytes',
    );
    this.maxKeys = positiveInteger(options?.maxKeys ?? DEFAULT_JWKS_MAX_KEYS, 'maxKeys');
    this.eventSink = assertAuthenticationEventSinkPort(options?.eventSink ?? new AuthenticationEventSinkPort());
    this.cache = null;
    this.refreshPromise = null;
    this.lastRefreshAt = Number.NEGATIVE_INFINITY;
  }

  async getSigningKey(request) {
    if (request?.issuer !== this.issuer) throw unauthenticated('JWT_ISSUER_MISMATCH');
    const kid = request?.kid;
    const alg = request?.alg;
    if (typeof kid !== 'string' || typeof alg !== 'string') throw unauthenticated('JWT_KID_INVALID');
    const now = this.clock();
    if (!this.cache || this.cache.expiresAt <= now) {
      await this.refresh({ requestId: request?.requestId, force: false });
    }
    let key = this.cache?.keys.get(kid);
    if (key) return structuredClone(key);
    if (now - this.lastRefreshAt >= this.minimumRefreshIntervalMs) {
      await this.refresh({ requestId: request?.requestId, force: true });
      key = this.cache?.keys.get(kid);
    }
    if (!key) throw unauthenticated('JWKS_KEY_NOT_FOUND');
    return structuredClone(key);
  }

  async refresh({ requestId, force }) {
    const now = this.clock();
    if (!force && this.cache && this.cache.expiresAt > now) return;
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.fetchJwks(requestId).finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async fetchJwks(requestId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    timeout.unref?.();
    let response;
    let text;
    try {
      response = await this.fetcher(this.jwksUri, {
        method: 'GET',
        headers: { accept: 'application/jwk-set+json, application/json' },
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response || typeof response !== 'object' || response.ok !== true) {
        throw authenticationUnavailable('JWKS_HTTP_ERROR');
      }
      const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
      if (!contentType.includes('application/json') && !contentType.includes('application/jwk-set+json')) {
        throw authenticationUnavailable('JWKS_CONTENT_TYPE_INVALID');
      }
      const contentLength = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(contentLength) && contentLength > this.maxResponseBytes) {
        throw authenticationUnavailable('JWKS_RESPONSE_TOO_LARGE');
      }
      text = await readBoundedBody(response, this.maxResponseBytes);
    } catch (error) {
      if (error instanceof HttpBoundaryError) throw error;
      throw authenticationUnavailable(
        error?.name === 'AbortError' ? 'JWKS_FETCH_TIMEOUT' : 'JWKS_FETCH_FAILED',
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
    let document;
    try {
      document = JSON.parse(text);
    } catch (error) {
      throw authenticationUnavailable('JWKS_JSON_INVALID', error);
    }
    const keys = validateJwksDocument(document, this.maxKeys);
    const now = this.clock();
    const ttl = resolveCacheTtl(response.headers?.get?.('cache-control'), this.cacheTtlMs, this.maxCacheTtlMs);
    this.cache = { keys, fetchedAt: now, expiresAt: now + ttl };
    this.lastRefreshAt = now;
    await safeRecord(this.eventSink, createAuthenticationEvent({
      type: 'JWKS_REFRESHED',
      at: new Date(now).toISOString(),
      requestId,
      issuer: this.issuer,
      reasonCode: 'JWKS_REFRESHED',
      keyCount: keys.size,
    }));
  }
}

async function readBoundedBody(response, maximumBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maximumBytes) {
      throw authenticationUnavailable('JWKS_RESPONSE_TOO_LARGE');
    }
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw authenticationUnavailable('JWKS_RESPONSE_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

function validateJwksDocument(document, maxKeys) {
  if (!document || typeof document !== 'object' || Array.isArray(document) || !Array.isArray(document.keys)) {
    throw authenticationUnavailable('JWKS_DOCUMENT_INVALID');
  }
  if (document.keys.length === 0 || document.keys.length > maxKeys) {
    throw authenticationUnavailable('JWKS_KEY_COUNT_INVALID');
  }
  const keys = new Map();
  for (const key of document.keys) {
    if (!key || typeof key !== 'object' || Array.isArray(key) ||
        typeof key.kid !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key.kid) ||
        keys.has(key.kid)) {
      throw authenticationUnavailable('JWKS_KEY_INVALID');
    }
    if (key.kty !== 'RSA' || !isCanonicalBase64Url(key.n) || !isCanonicalBase64Url(key.e) ||
        Buffer.from(key.n, 'base64url').length < 256) {
      throw authenticationUnavailable('JWKS_KEY_INVALID');
    }
    keys.set(key.kid, structuredClone(key));
  }
  return keys;
}

function isCanonicalBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length > 0 && bytes.toString('base64url') === value;
}

function resolveCacheTtl(cacheControl, fallback, maximum) {
  const match = /(?:^|,)\s*max-age\s*=\s*(\d+)\s*(?:,|$)/i.exec(String(cacheControl ?? ''));
  const headerTtl = match ? Number(match[1]) * 1000 : fallback;
  if (!Number.isSafeInteger(headerTtl) || headerTtl <= 0) return Math.min(fallback, maximum);
  return Math.min(headerTtl, maximum);
}

function validateHttpsUrl(input, field, allowHttp) {
  httpInvariant(typeof input === 'string' && input.length <= 2048,
    'INVALID_OIDC_CONFIG', `${field} must be a URL`, 500);
  let url;
  try { url = new URL(input); } catch { url = null; }
  httpInvariant(url && (url.protocol === 'https:' || (allowHttp && url.protocol === 'http:')) &&
    url.username === '' && url.password === '' && url.hash === '',
  'INVALID_OIDC_CONFIG', `${field} must use an allowed absolute URL`, 500);
  return input;
}

function positiveInteger(value, field) {
  httpInvariant(Number.isSafeInteger(value) && value > 0,
    'INVALID_OIDC_CONFIG', `${field} must be a positive integer`, 500);
  return value;
}

function nonNegativeInteger(value, field) {
  httpInvariant(Number.isSafeInteger(value) && value >= 0,
    'INVALID_OIDC_CONFIG', `${field} must be a non-negative integer`, 500);
  return value;
}

async function safeRecord(sink, event) {
  try { await sink.record(event); } catch {}
}
