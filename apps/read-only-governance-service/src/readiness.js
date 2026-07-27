import { createRuntimeEvent, safeRecordRuntimeEvent } from './runtime-events.js';
import { serviceInvariant } from './errors.js';

export const SERVICE_HEALTH_SCHEMA_VERSION = 'service-health/v1';

export class ReadinessCoordinator {
  constructor({ serviceName, checks = [], timeoutMs = 3000, clock = () => Date.now(), runtimeEvents }) {
    serviceInvariant(typeof serviceName === 'string' && serviceName.length > 0,
      'INVALID_READINESS_CONFIG', 'Readiness serviceName is required');
    serviceInvariant(Array.isArray(checks) && checks.length > 0,
      'INVALID_READINESS_CONFIG', 'Readiness checks must be a non-empty array');
    serviceInvariant(Number.isSafeInteger(timeoutMs) && timeoutMs > 0,
      'INVALID_READINESS_CONFIG', 'Readiness timeoutMs must be positive');
    this.serviceName = serviceName;
    this.checks = checks.map(validateCheck);
    this.timeoutMs = timeoutMs;
    this.clock = clock;
    this.runtimeEvents = runtimeEvents;
    this.startedAt = null;
    this.stopping = false;
    this.lastReady = null;
    this.inFlight = null;
  }

  markStarted(at = this.clock()) {
    this.startedAt = at;
    this.stopping = false;
  }

  markStopping() { this.stopping = true; }

  live() {
    return {
      schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
      service: this.serviceName,
      status: this.stopping ? 'stopping' : 'live',
      uptimeSeconds: this.startedAt === null ? 0 : Math.max(0, Math.floor((this.clock() - this.startedAt) / 1000)),
      checks: [],
    };
  }

  async ready() {
    if (this.stopping || this.startedAt === null) return this.notReady('service');
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.runChecks().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async runChecks() {
    const results = await Promise.all(this.checks.map(async (check) => {
      try {
        await withTimeout(Promise.resolve().then(check.check), this.timeoutMs);
        return { name: check.name, status: 'ok' };
      } catch {
        return { name: check.name, status: 'failed' };
      }
    }));
    const ready = results.every((result) => result.status === 'ok');
    if (ready !== this.lastReady) {
      this.lastReady = ready;
      await safeRecordRuntimeEvent(this.runtimeEvents, createRuntimeEvent({
        type: ready ? 'SERVICE_READY' : 'SERVICE_NOT_READY',
        service: this.serviceName,
        details: { failedChecks: results.filter((item) => item.status !== 'ok').length },
      }));
    }
    return {
      statusCode: ready ? 200 : 503,
      body: {
        schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
        service: this.serviceName,
        status: ready ? 'ready' : 'not_ready',
        uptimeSeconds: Math.max(0, Math.floor((this.clock() - this.startedAt) / 1000)),
        checks: results,
      },
    };
  }

  notReady(name) {
    return Promise.resolve({
      statusCode: 503,
      body: {
        schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
        service: this.serviceName,
        status: 'not_ready',
        uptimeSeconds: 0,
        checks: [{ name, status: 'failed' }],
      },
    });
  }
}

export function createPostgresReadinessCheck(pool) {
  serviceInvariant(pool && typeof pool.query === 'function',
    'INVALID_READINESS_CONFIG', 'PostgreSQL readiness requires pool.query()');
  return { name: 'postgres', async check() { await pool.query('SELECT 1'); } };
}

export function createJwksReadinessCheck(provider) {
  serviceInvariant(provider && typeof provider.refresh === 'function',
    'INVALID_READINESS_CONFIG', 'JWKS readiness requires provider.refresh()');
  return { name: 'jwks', async check() { await provider.refresh({ requestId: 'readiness', force: false }); } };
}

function validateCheck(input) {
  serviceInvariant(input && typeof input.name === 'string' && /^[a-z][a-z0-9-]{1,31}$/.test(input.name) &&
    typeof input.check === 'function',
  'INVALID_READINESS_CONFIG', 'Readiness check is invalid');
  return input;
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('readiness timeout')), timeoutMs);
  });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
}
