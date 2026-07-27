import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { AuthenticationEventSinkPort } from '@kdtp/governance-auth-oidc';
import { serviceInvariant } from './errors.js';

export const SERVICE_RUNTIME_EVENT_SCHEMA_VERSION = 'service-runtime-event/v1';
export const SERVICE_RUNTIME_EVENT_TYPES = Object.freeze([
  'SERVICE_STARTING',
  'MIGRATIONS_APPLIED',
  'JWKS_WARMED',
  'SERVICE_LISTENING',
  'SERVICE_READY',
  'SERVICE_NOT_READY',
  'SERVICE_STOPPING',
  'SERVICE_STOPPED',
  'SERVICE_FAILED',
  'AUTHENTICATION_EVENT',
]);
const SENSITIVE_KEY = /(token|credential|password|secret|private|database.?url|connection.?string|authorization)/i;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export class RuntimeEventSinkPort {
  async record() {}
}

export class InMemoryRuntimeEventSink extends RuntimeEventSinkPort {
  constructor() { super(); this.events = []; }
  async record(event) { this.events.push(validateRuntimeEvent(event)); }
  list() { return structuredClone(this.events); }
}

export class JsonLineRuntimeEventSink extends RuntimeEventSinkPort {
  constructor({ stream = process.stdout } = {}) {
    super();
    serviceInvariant(stream && typeof stream.write === 'function',
      'INVALID_RUNTIME_EVENT_SINK', 'Runtime event stream must expose write()');
    this.stream = stream;
  }
  async record(event) {
    const line = `${JSON.stringify(validateRuntimeEvent(event))}\n`;
    if (!this.stream.write(line)) await once(this.stream, 'drain');
  }
}

export class RuntimeAuthenticationEventSink extends AuthenticationEventSinkPort {
  constructor({ runtimeEvents, serviceName }) {
    super();
    this.runtimeEvents = assertRuntimeEventSink(runtimeEvents);
    this.serviceName = serviceName;
  }
  async record(event) {
    await this.runtimeEvents.record(createRuntimeEvent({
      type: 'AUTHENTICATION_EVENT',
      at: event.at,
      service: this.serviceName,
      requestId: event.requestId,
      details: {
        authenticationType: event.type,
        reasonCode: event.reasonCode,
        issuerFingerprint: fingerprint(event.issuer),
        kid: event.kid,
        subjectFingerprint: event.subjectFingerprint,
        keyCount: event.keyCount,
      },
    }));
  }
}

export function assertRuntimeEventSink(sink) {
  serviceInvariant(sink && typeof sink.record === 'function',
    'INVALID_RUNTIME_EVENT_SINK', 'Runtime event sink must expose record()');
  return sink;
}

export function createRuntimeEvent({ type, at = new Date().toISOString(), service, requestId = null, details = {} }) {
  return validateRuntimeEvent({
    schemaVersion: SERVICE_RUNTIME_EVENT_SCHEMA_VERSION,
    type,
    at,
    service,
    requestId,
    details: cleanDetails(details),
  });
}

export function validateRuntimeEvent(input) {
  serviceInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_RUNTIME_EVENT', 'Runtime event must be an object');
  serviceInvariant(input.schemaVersion === SERVICE_RUNTIME_EVENT_SCHEMA_VERSION,
    'INVALID_RUNTIME_EVENT', 'Runtime event schema version is invalid');
  serviceInvariant(SERVICE_RUNTIME_EVENT_TYPES.includes(input.type),
    'INVALID_RUNTIME_EVENT', 'Runtime event type is invalid');
  serviceInvariant(typeof input.at === 'string' && Number.isFinite(Date.parse(input.at)),
    'INVALID_RUNTIME_EVENT', 'Runtime event timestamp is invalid');
  serviceInvariant(typeof input.service === 'string' && input.service.length > 0 && input.service.length <= 128,
    'INVALID_RUNTIME_EVENT', 'Runtime event service is invalid');
  serviceInvariant(input.requestId === null ||
    (typeof input.requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(input.requestId)),
  'INVALID_RUNTIME_EVENT', 'Runtime event requestId is invalid');
  return {
    schemaVersion: input.schemaVersion,
    type: input.type,
    at: new Date(input.at).toISOString(),
    service: input.service,
    requestId: input.requestId,
    details: cleanDetails(input.details ?? {}),
  };
}

export async function safeRecordRuntimeEvent(sink, event) {
  try { await assertRuntimeEventSink(sink).record(event); } catch {}
}

function cleanDetails(input) {
  serviceInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_RUNTIME_EVENT', 'Runtime event details must be an object');
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  serviceInvariant(entries.length <= 24,
    'INVALID_RUNTIME_EVENT', 'Runtime event details contain too many fields');
  const output = {};
  for (const [key, value] of entries) {
    serviceInvariant(FIELD_PATTERN.test(key) && !SENSITIVE_KEY.test(key),
      'INVALID_RUNTIME_EVENT', 'Runtime event detail key is unsafe', { key });
    output[key] = cleanScalar(value, key);
  }
  return output;
}

function cleanScalar(value, key) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    serviceInvariant(Number.isFinite(value), 'INVALID_RUNTIME_EVENT', 'Runtime event number is invalid', { key });
    return value;
  }
  if (typeof value === 'string') {
    serviceInvariant(value.length <= 512 && !/[\r\n\u0000]/.test(value),
      'INVALID_RUNTIME_EVENT', 'Runtime event string is invalid', { key });
    return value;
  }
  serviceInvariant(false, 'INVALID_RUNTIME_EVENT', 'Runtime event details support scalar values only', { key });
}

function fingerprint(value) {
  return typeof value === 'string' && value.length > 0
    ? createHash('sha256').update(value).digest('hex')
    : undefined;
}
