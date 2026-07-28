import { createServer } from 'node:http';
import {
  OidcJwksBearerAuthentication,
  RemoteJwksProvider,
  StaticSubjectMapper,
} from '@kdtp/governance-auth-oidc';
import {
  AuthenticatedRequestIdentityContext,
  InMemoryFixedWindowRateLimiter,
  ReadOnlyGovernanceHttpTransport,
  createReadOnlyNodeHttpHandler,
} from '@kdtp/governance-http';
import {
  ReadOnlyGovernanceQueryHandlers,
  ReadOnlyGovernanceQueryService,
} from '@kdtp/governance-query';
import {
  PostgresKnowledgeSnapshotStore,
  PostgresReviewDecisionStore,
  applyGovernancePostgresMigrations,
} from '@kdtp/knowledge-governance-postgres';
import {
  PostgresKnowledgeRegistry,
  applyPostgresMigrations,
} from '@kdtp/knowledge-registry-postgres';
import {
  PostgresProjectMembershipAuthorization,
  applyProjectAccessPostgresMigrations,
} from '@kdtp/project-membership-postgres';
import {
  ReadOnlyTestPlanHttpTransport,
  createReadOnlyTestPlanNodeHttpHandler,
} from '@kdtp/test-plan-http';
import {
  ReadOnlyTestPlanQueryHandlers,
  ReadOnlyTestPlanQueryService,
} from '@kdtp/test-plan-query';
import {
  PostgresTestPlanRegistry,
  applyTestPlanMigrations,
} from '@kdtp/test-plan-postgres';
import { createCompositeReadOnlyNodeHttpHandler } from './business-http.js';
import { createOperationalNodeHttpHandler } from './operational-http.js';
import {
  ReadinessCoordinator,
  createJwksReadinessCheck,
  createPostgresReadinessCheck,
} from './readiness.js';
import {
  RuntimeAuthenticationEventSink,
  createRuntimeEvent,
  safeRecordRuntimeEvent,
} from './runtime-events.js';
import { ManagedReadOnlyService } from './service.js';

export async function createReadOnlyServiceComposition(options) {
  const config = options.config;
  const pool = options.pool;
  const runtimeEvents = options.runtimeEvents;
  const clock = options.clock ?? (() => Date.now());
  const migrations = options.migrations ?? [
    applyPostgresMigrations,
    applyGovernancePostgresMigrations,
    applyProjectAccessPostgresMigrations,
    applyTestPlanMigrations,
  ];
  await safeRecordRuntimeEvent(runtimeEvents, createRuntimeEvent({
    type: 'SERVICE_STARTING', service: config.serviceName,
  }));
  for (const runMigration of migrations) await runMigration({ pool });
  await safeRecordRuntimeEvent(runtimeEvents, createRuntimeEvent({
    type: 'MIGRATIONS_APPLIED', service: config.serviceName, details: { migrationGroups: migrations.length },
  }));

  const authenticationEvents = new RuntimeAuthenticationEventSink({ runtimeEvents, serviceName: config.serviceName });
  const subjectMapper = options.subjectMapper ?? new StaticSubjectMapper(config.oidc.subjectMappings);
  const jwksProvider = options.jwksProvider ?? new RemoteJwksProvider({
    issuer: config.oidc.issuer,
    jwksUri: config.oidc.jwksUri,
    timeoutMs: config.oidc.jwksTimeoutMs,
    cacheTtlMs: config.oidc.jwksCacheTtlMs,
    maxCacheTtlMs: config.oidc.jwksMaxCacheTtlMs,
    eventSink: authenticationEvents,
    fetcher: options.fetcher,
    clock,
  });
  await jwksProvider.refresh({ requestId: 'startup', force: false });
  await safeRecordRuntimeEvent(runtimeEvents, createRuntimeEvent({
    type: 'JWKS_WARMED', service: config.serviceName,
  }));

  const authentication = options.authentication ?? new OidcJwksBearerAuthentication({
    issuer: config.oidc.issuer,
    audiences: config.oidc.audiences,
    clockSkewSeconds: config.oidc.clockSkewSeconds,
    maxTokenAgeSeconds: config.oidc.maxTokenAgeSeconds,
    subjectMapper,
    jwksProvider,
    eventSink: authenticationEvents,
    clock,
  });
  const registry = options.registry ?? new PostgresKnowledgeRegistry({ pool });
  const reviewStore = options.reviewStore ?? new PostgresReviewDecisionStore({ pool });
  const snapshotStore = options.snapshotStore ?? new PostgresKnowledgeSnapshotStore({ pool });
  const authorization = options.authorization ?? new PostgresProjectMembershipAuthorization({
    pool,
    clock: { async now() { return new Date(clock()).toISOString(); } },
  });
  const identityContext = options.identityContext ?? new AuthenticatedRequestIdentityContext();
  const rateLimiter = options.rateLimiter ?? new InMemoryFixedWindowRateLimiter({
    ...config.rateLimit,
    clock,
  });
  const queryService = new ReadOnlyGovernanceQueryService({ registry, authorization, reviewStore, snapshotStore });
  const handlers = new ReadOnlyGovernanceQueryHandlers({ service: queryService, identityContext });
  const transport = new ReadOnlyGovernanceHttpTransport({
    handlers,
    authentication,
    rateLimiter,
    maxBodyBytes: config.http.maxBodyBytes,
    maxUrlLength: config.http.maxUrlLength,
    clock,
    requestIdFactory: options.requestIdFactory,
  });
  const testPlanRegistry = options.testPlanRegistry ?? new PostgresTestPlanRegistry({ pool });
  const testPlanQueryService = new ReadOnlyTestPlanQueryService({
    registry: testPlanRegistry,
    authorization,
  });
  const testPlanHandlers = new ReadOnlyTestPlanQueryHandlers({
    service: testPlanQueryService,
    identityContext,
  });
  const testPlanTransport = new ReadOnlyTestPlanHttpTransport({
    handlers: testPlanHandlers,
    authentication,
    rateLimiter,
    maxBodyBytes: config.http.maxBodyBytes,
    maxUrlLength: config.http.maxUrlLength,
    clock,
    requestIdFactory: options.requestIdFactory,
  });
  const knowledgeBusinessHandler = createReadOnlyNodeHttpHandler({ transport });
  const testPlanBusinessHandler = createReadOnlyTestPlanNodeHttpHandler({
    transport: testPlanTransport,
  });
  const businessHandler = createCompositeReadOnlyNodeHttpHandler({
    knowledgeHandler: knowledgeBusinessHandler,
    testPlanHandler: testPlanBusinessHandler,
  });
  const readiness = new ReadinessCoordinator({
    serviceName: config.serviceName,
    checks: [createPostgresReadinessCheck(pool), createJwksReadinessCheck(jwksProvider)],
    timeoutMs: config.operations.readinessTimeoutMs,
    clock,
    runtimeEvents,
  });
  const handler = createOperationalNodeHttpHandler({
    businessHandler,
    readiness,
    requestIdFactory: options.requestIdFactory,
  });
  const server = (options.serverFactory ?? createServer)(handler);
  const service = new ManagedReadOnlyService({ server, pool, readiness, runtimeEvents, config, clock });
  return {
    service,
    components: {
      pool,
      jwksProvider,
      authentication,
      authorization,
      registry,
      reviewStore,
      snapshotStore,
      testPlanRegistry,
      queryService,
      testPlanQueryService,
      handlers,
      testPlanHandlers,
      transport,
      testPlanTransport,
      rateLimiter,
      identityContext,
      readiness,
      server,
    },
  };
}
