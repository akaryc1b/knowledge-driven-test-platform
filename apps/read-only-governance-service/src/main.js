#!/usr/bin/env node
import { loadServiceConfig } from './config.js';
import { createReadOnlyServiceComposition } from './composition.js';
import {
  JsonLineRuntimeEventSink,
  createRuntimeEvent,
  safeRecordRuntimeEvent,
} from './runtime-events.js';
import { installShutdownSignals } from './service.js';

const runtimeEvents = new JsonLineRuntimeEventSink();
let pool = null;
try {
  const config = loadServiceConfig(process.env);
  const { Pool } = await import('pg');
  pool = new Pool({
    connectionString: config.database.url,
    max: config.database.maxPoolSize,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
    idleTimeoutMillis: config.database.idleTimeoutMs,
    application_name: config.serviceName,
  });
  const { service } = await createReadOnlyServiceComposition({ config, pool, runtimeEvents });
  installShutdownSignals(service);
  await service.start();
} catch (error) {
  await safeRecordRuntimeEvent(runtimeEvents, createRuntimeEvent({
    type: 'SERVICE_FAILED',
    service: safeServiceName(process.env.KDTP_SERVICE_NAME),
    details: { reasonCode: typeof error?.code === 'string' ? error.code : 'SERVICE_START_FAILED' },
  }));
  try { await pool?.end?.(); } catch {}
  process.exitCode = 1;
}

function safeServiceName(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(value)
    ? value
    : 'kdtp-read-only-governance';
}
