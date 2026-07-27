import { createHash } from 'node:crypto';
import { httpInvariant } from '@kdtp/governance-http';
import { OIDC_AUTH_EVENT_SCHEMA_VERSION, OIDC_AUTH_EVENT_TYPES } from './constants.js';

export function createAuthenticationEvent(input) {
  httpInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_AUTHENTICATION_EVENT', 'Authentication event input must be an object', 500);
  httpInvariant(OIDC_AUTH_EVENT_TYPES.includes(input.type),
    'INVALID_AUTHENTICATION_EVENT', 'Authentication event type is invalid', 500);
  const eventTime = typeof input.at === 'string' ? Date.parse(input.at) : Number.NaN;
  httpInvariant(Number.isFinite(eventTime) && new Date(eventTime).toISOString() === input.at,
    'INVALID_AUTHENTICATION_EVENT', 'Authentication event timestamp is invalid', 500);
  validateOptional(input.requestId, /^[A-Za-z0-9._:-]{1,128}$/, 'requestId');
  validateOptional(input.issuer, /^.{1,2048}$/u, 'issuer');
  validateOptional(input.kid, /^[A-Za-z0-9._:-]{1,128}$/, 'kid');
  validateOptional(input.reasonCode, /^[A-Z][A-Z0-9_]{1,127}$/, 'reasonCode');
  validateOptional(input.subject, /^.{1,255}$/u, 'subject');
  if (input.keyCount !== undefined) {
    httpInvariant(Number.isSafeInteger(input.keyCount) && input.keyCount >= 0 && input.keyCount <= 1024,
      'INVALID_AUTHENTICATION_EVENT', 'Authentication event keyCount is invalid', 500);
  }
  const event = {
    schemaVersion: OIDC_AUTH_EVENT_SCHEMA_VERSION,
    type: input.type,
    at: input.at,
    requestId: input.requestId ?? null,
    issuer: input.issuer ?? null,
    keyId: input.kid ?? null,
    reasonCode: input.reasonCode ?? null,
    subjectFingerprint: input.subject
      ? createHash('sha256').update(`${input.issuer}\u0000${input.subject}`).digest('hex')
      : null,
  };
  if (Number.isSafeInteger(input.keyCount)) event.keyCount = input.keyCount;
  return event;
}

export async function safeRecordAuthenticationEvent(sink, event) {
  try { await sink.record(event); } catch {}
}

function validateOptional(value, pattern, field) {
  httpInvariant(value === undefined || value === null ||
    (typeof value === 'string' && pattern.test(value)),
  'INVALID_AUTHENTICATION_EVENT', `Authentication event ${field} is invalid`, 500);
}
