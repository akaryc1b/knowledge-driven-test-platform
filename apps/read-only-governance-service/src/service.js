import { createRuntimeEvent, safeRecordRuntimeEvent } from './runtime-events.js';
import { serviceInvariant } from './errors.js';

export class ManagedReadOnlyService {
  constructor({ server, pool, readiness, runtimeEvents, config, clock = () => Date.now() }) {
    serviceInvariant(server && typeof server.listen === 'function' && typeof server.close === 'function',
      'INVALID_SERVICE_COMPONENT', 'Managed service requires an HTTP server');
    serviceInvariant(pool && typeof pool.end === 'function',
      'INVALID_SERVICE_COMPONENT', 'Managed service requires a PostgreSQL pool');
    this.server = server;
    this.pool = pool;
    this.readiness = readiness;
    this.runtimeEvents = runtimeEvents;
    this.config = config;
    this.clock = clock;
    this.sockets = new Set();
    this.started = false;
    this.stopping = null;
    server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });
  }

  async start() {
    serviceInvariant(!this.started, 'SERVICE_ALREADY_STARTED', 'Read-only service is already started');
    this.server.requestTimeout = this.config.http.requestTimeoutMs;
    this.server.headersTimeout = this.config.http.headersTimeoutMs;
    this.server.keepAliveTimeout = this.config.http.keepAliveTimeoutMs;
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        this.server.removeListener('error', onError);
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.config.http.port, this.config.http.host);
    });
    this.started = true;
    this.readiness.markStarted(this.clock());
    const address = this.server.address();
    await safeRecordRuntimeEvent(this.runtimeEvents, createRuntimeEvent({
      type: 'SERVICE_LISTENING',
      service: this.config.serviceName,
      details: {
        host: typeof address === 'object' && address ? address.address : this.config.http.host,
        port: typeof address === 'object' && address ? address.port : this.config.http.port,
      },
    }));
    const readiness = await this.readiness.ready();
    if (readiness.statusCode !== 200) {
      await this.stop('startup-readiness-failed');
      serviceInvariant(false, 'SERVICE_STARTUP_NOT_READY', 'Read-only service failed its startup readiness check');
    }
    return address;
  }

  async stop(reason = 'shutdown') {
    if (this.stopping) return this.stopping;
    this.stopping = this.performStop(reason);
    return this.stopping;
  }

  async performStop(reason) {
    this.readiness.markStopping();
    await safeRecordRuntimeEvent(this.runtimeEvents, createRuntimeEvent({
      type: 'SERVICE_STOPPING',
      service: this.config.serviceName,
      details: { reason },
    }));
    this.server.closeIdleConnections?.();
    let forcedConnections = 0;
    if (this.started) {
      const closed = new Promise((resolve) => this.server.close(() => resolve(true)));
      const completed = await settleWithin(closed, this.config.operations.shutdownTimeoutMs);
      if (!completed) {
        forcedConnections = this.sockets.size;
        this.server.closeAllConnections?.();
        for (const socket of this.sockets) socket.destroy?.();
        await settleWithin(closed, 1000);
      }
    }
    await this.pool.end();
    await safeRecordRuntimeEvent(this.runtimeEvents, createRuntimeEvent({
      type: 'SERVICE_STOPPED',
      service: this.config.serviceName,
      details: { forcedConnections },
    }));
  }
}

export function installShutdownSignals(service, { processRef = process } = {}) {
  let handled = false;
  const handler = (signal) => {
    if (handled) return;
    handled = true;
    service.stop(signal).catch(() => { processRef.exitCode = 1; });
  };
  processRef.once('SIGTERM', handler);
  processRef.once('SIGINT', handler);
  return () => {
    processRef.removeListener('SIGTERM', handler);
    processRef.removeListener('SIGINT', handler);
  };
}

async function settleWithin(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref?.();
  });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
}
