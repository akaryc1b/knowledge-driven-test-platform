import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import {
  InMemoryProjectAuthorization,
  REVIEW_DECISION_SCHEMA_VERSION,
  createSnapshotEnvelope,
} from '@kdtp/knowledge-governance';
import { GOVERNANCE_POSTGRES_SCHEMA } from '@kdtp/knowledge-governance-postgres';
import { POSTGRES_SCHEMA } from '@kdtp/knowledge-registry-postgres';
import { RemoteJwksProvider } from '@kdtp/governance-auth-oidc';
import {
  PostgresProjectDirectory,
  PostgresProjectMembershipStore,
  PROJECT_ACCESS_POSTGRES_SCHEMA,
} from '@kdtp/project-membership-postgres';
import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import {
  TEST_PLAN_POSTGRES_SCHEMA,
} from '@kdtp/test-plan-postgres';
import {
  DurablePlanningOrchestrationService,
  PostgresPlanningUnitOfWork,
} from '@kdtp/test-planning-orchestration';
import { request, planner } from '../../../packages/test-planner/test/test-helpers.js';
import {
  InMemoryRuntimeEventSink,
  createReadOnlyServiceComposition,
  loadServiceConfig,
} from '../src/index.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('M2-H planning service integration requires KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');

  test('M2-H composes ten read routes with shared PostgreSQL, JWKS, JWT and membership recovery',
    { concurrency: false }, async (context) => {
      let now = Date.parse('2026-07-28T04:30:00.000Z');
      const issuer = 'https://m2-h-issuer.example.test';
      const audience = 'kdtp-read-api';
      const projectId = 'approval-platform';
      const subject = 'm2-h-subject-001';
      const actor = 'm2-h-auditor';
      const knowledgeId = 'PROJECT-M2-H-001';
      const knowledgeVersion = '1.0.0';
      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const publicJwk = {
        ...publicKey.export({ format: 'jwk' }),
        kid: 'm2-h-key-1',
        alg: 'RS256',
        use: 'sig',
        key_ops: ['verify'],
      };
      let jwksAvailable = true;
      const jwksServer = createServer((incoming, response) => {
        if (incoming.url !== '/jwks') {
          response.statusCode = 404;
          response.end();
          return;
        }
        if (!jwksAvailable) {
          response.statusCode = 503;
          response.end();
          return;
        }
        response.setHeader('content-type', 'application/jwk-set+json');
        response.setHeader('cache-control', 'max-age=1');
        response.end(JSON.stringify({ keys: [publicJwk] }));
      });
      jwksServer.listen(0, '127.0.0.1');
      await once(jwksServer, 'listening');
      const jwksAddress = jwksServer.address();

      const realPool = new Pool({ connectionString, max: 12 });
      let postgresReady = true;
      const pool = {
        connect: (...args) => realPool.connect(...args),
        async query(query, ...args) {
          const text = typeof query === 'string' ? query : query?.text;
          if (String(text).trim() === 'SELECT 1' && !postgresReady) {
            throw new Error('forced PostgreSQL readiness outage');
          }
          return realPool.query(query, ...args);
        },
        end: () => realPool.end(),
      };
      const runtimeEvents = new InMemoryRuntimeEventSink();
      let composition = null;

      context.after(async () => {
        if (composition) await composition.service.stop('m2-h-e2e-cleanup').catch(() => {});
        else await realPool.end().catch(() => {});
        await closeServer(jwksServer);
      });

      const config = structuredClone(loadServiceConfig({
        KDTP_SERVICE_NAME: 'm2-h-read-only-planning',
        KDTP_DATABASE_URL: connectionString,
        KDTP_HTTP_HOST: '127.0.0.1',
        KDTP_HTTP_PORT: '8080',
        KDTP_OIDC_ISSUER: issuer,
        KDTP_OIDC_JWKS_URI: `${issuer}/jwks`,
        KDTP_OIDC_AUDIENCE: audience,
        KDTP_OIDC_SUBJECT_MAPPINGS_JSON: JSON.stringify([{ subject, actor }]),
        KDTP_READINESS_TIMEOUT_MS: '3000',
        KDTP_SHUTDOWN_TIMEOUT_MS: '3000',
      }));
      config.http.port = 0;

      const jwksProvider = new RemoteJwksProvider({
        issuer,
        jwksUri: `http://127.0.0.1:${jwksAddress.port}/jwks`,
        allowHttpForTesting: true,
        minimumRefreshIntervalMs: 0,
        cacheTtlMs: 1000,
        maxCacheTtlMs: 1000,
        timeoutMs: 1000,
        clock: () => now,
      });
      composition = await createReadOnlyServiceComposition({
        config,
        pool,
        runtimeEvents,
        jwksProvider,
        clock: () => now,
        requestIdFactory: () => 'm2-h-generated-request',
      });

      await resetM2HData(pool);
      const directory = new PostgresProjectDirectory({ pool });
      const memberships = new PostgresProjectMembershipStore({ pool });
      await directory.createProject({
        projectId,
        name: 'M2-H Approval Platform',
        actor: 'm2-h-admin',
        at: iso(now - 120_000),
        reason: 'create unified read-only project',
      });
      await memberships.createMembership({
        projectId,
        subject: actor,
        roles: ['AUDITOR'],
        validFrom: iso(now - 120_000),
        validUntil: null,
        actor: 'm2-h-admin',
        at: iso(now - 110_000),
        reason: 'grant unified read-only audit access',
      });

      let knowledgeRecord = await composition.components.registry.createDraft({
        knowledge: {
          schemaVersion: 'knowledge-rule/v1',
          id: knowledgeId,
          boundaryKey: 'm2-h.unified-read-only-service',
          name: 'M2-H unified read-only service rule',
          version: knowledgeVersion,
          status: 'DRAFT',
          scope: { level: 'PROJECT', key: projectId },
          enforcement: 'mandatory',
          overridePolicy: 'deny',
          enabled: true,
          value: { knowledgeRoutes: 5, testPlanRoutes: 5, writesAllowed: false },
          owner: 'quality-platform-team',
          source: 'M2-H service integration',
          riskLevel: 'critical',
        },
        actor: 'm2-h-author',
        at: iso(now - 100_000),
        reason: 'create M2-H knowledge',
      });
      knowledgeRecord = await composition.components.registry.transition({
        id: knowledgeId,
        version: knowledgeVersion,
        expectedRevision: knowledgeRecord.revision,
        toStatus: 'REVIEWING',
        actor: 'm2-h-author',
        at: iso(now - 90_000),
        reason: 'submit M2-H knowledge',
      });
      await composition.components.reviewStore.append({
        schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
        decisionId: 'decision:m2-h:knowledge-0001',
        projectId,
        knowledgeKey: knowledgeRecord.key,
        knowledgeId,
        version: knowledgeVersion,
        reviewRevision: knowledgeRecord.revision,
        decision: 'APPROVE',
        reviewer: 'm2-h-reviewer',
        at: iso(now - 80_000),
        reason: 'approve M2-H knowledge',
      });
      knowledgeRecord = await composition.components.registry.transition({
        id: knowledgeId,
        version: knowledgeVersion,
        expectedRevision: knowledgeRecord.revision,
        toStatus: 'PUBLISHED',
        actor: 'm2-h-publisher',
        at: iso(now - 70_000),
        reason: 'publish M2-H knowledge',
      });

      const snapshot = buildKnowledgeSnapshot({
        context: {
          globalId: 'company',
          projectId,
          environmentId: 'integration',
          releaseId: 'M2-H-E2E',
          domainPacks: [],
        },
        rules: [knowledgeRecord.knowledge],
        resolution: [],
      });
      await composition.components.snapshotStore.save(createSnapshotEnvelope({
        projectId,
        snapshot,
        actor: 'm2-h-publisher',
        at: iso(now - 60_000),
        reason: 'persist M2-H integration snapshot',
      }));

      const catalog = createBaseCapabilityCatalog('1.0.1');
      const planningRequest = request({ catalog });
      const grant = (grantActor, actions) => ({ projectId, actor: grantActor, actions });
      const planningAuthorization = new InMemoryProjectAuthorization([
        grant('planner-service', ['PLAN_GENERATE', 'PLAN_SUBMIT', 'PLAN_READ']),
        grant('reviewer-one', ['PLAN_REVIEW']),
        grant('reviewer-two', ['PLAN_REVIEW']),
        grant('approval-governor', ['PLAN_APPROVE']),
        grant('freeze-owner', ['PLAN_FREEZE', 'PLAN_READ', 'PLAN_AUDIT_READ']),
      ]);
      const orchestration = new DurablePlanningOrchestrationService({
        planner: planner(catalog),
        planningUnitOfWork: new PostgresPlanningUnitOfWork({
          pool,
          authorization: planningAuthorization,
        }),
      });
      const generated = await orchestration.generate({
        planningRequest,
        actor: 'planner-service',
        at: iso(now - 50_000),
        reason: 'generate M2-H test plan',
      });
      let planRecord = await orchestration.submit({
        planId: generated.record.planId,
        actor: 'planner-service',
        at: iso(now - 40_000),
        reason: 'submit M2-H test plan',
      });
      await orchestration.review({
        planId: planRecord.planId,
        actor: 'reviewer-one',
        decision: 'APPROVE',
        at: iso(now - 30_000),
        reason: 'first M2-H review',
      });
      await orchestration.review({
        planId: planRecord.planId,
        actor: 'reviewer-two',
        decision: 'APPROVE',
        at: iso(now - 20_000),
        reason: 'second M2-H review',
      });
      planRecord = (await orchestration.approve({
        planId: planRecord.planId,
        actor: 'approval-governor',
        at: iso(now - 10_000),
        reason: 'approve M2-H plan',
      })).record;
      planRecord = (await orchestration.freeze({
        planId: planRecord.planId,
        actor: 'freeze-owner',
        at: iso(now - 5_000),
        reason: 'freeze M2-H plan',
      })).record;

      const address = await composition.service.start();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const token = signJwt(privateKey, { alg: 'RS256', kid: publicJwk.kid }, {
        iss: issuer,
        sub: subject,
        aud: audience,
        iat: Math.floor((now - 30_000) / 1000),
        exp: Math.floor((now + 300_000) / 1000),
      });
      const headers = {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        'x-request-id': 'm2-h-e2e-request',
      };

      const knowledgeList = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge?status=PUBLISHED&limit=10`, headers);
      const knowledgeDetail = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge/${knowledgeId}/versions/${knowledgeVersion}`, headers);
      const knowledgeTimeline = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge/${knowledgeId}/versions/${knowledgeVersion}/timeline`, headers);
      const snapshotList = await getJson(`${baseUrl}/v1/projects/${projectId}/snapshots?releaseId=M2-H-E2E`, headers);
      const snapshotDetail = await getJson(`${baseUrl}/v1/projects/${projectId}/snapshots/${snapshot.snapshotId}`, headers);
      const planList = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans?status=FROZEN&limit=10`, headers);
      const planDetail = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans/${planRecord.planId}`, headers);
      const coverage = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans/${planRecord.planId}/coverage`, headers);
      const provenance = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans/${planRecord.planId}/provenance`, headers);
      const planTimeline = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans/${planRecord.planId}/timeline`, headers);

      const ten = [knowledgeList, knowledgeDetail, knowledgeTimeline, snapshotList, snapshotDetail,
        planList, planDetail, coverage, provenance, planTimeline];
      assert.deepEqual(ten.map((item) => item.response.status), Array(10).fill(200));
      assert.equal(knowledgeList.body.data.items[0].key, knowledgeRecord.key);
      assert.equal(knowledgeDetail.body.data.value.writesAllowed, false);
      assert(knowledgeTimeline.body.data.events.some((event) => event.toStatus === 'PUBLISHED'));
      assert.equal(snapshotList.body.data.items[0].snapshotId, snapshot.snapshotId);
      assert.equal(snapshotDetail.body.data.digest, snapshot.digest);
      assert.equal(planList.body.data.items[0].planId, planRecord.planId);
      assert.equal(planDetail.body.data.status, 'FROZEN');
      assert.equal(planDetail.body.data.revision, 4);
      assert.equal(Object.hasOwn(planDetail.body.data, 'inputFingerprint'), false);
      assert.equal(coverage.body.data.revision, planDetail.body.data.revision);
      assert.equal(provenance.body.data.revision, planDetail.body.data.revision);
      assert.equal(planTimeline.body.data.revision, planDetail.body.data.revision);
      assert.equal(planTimeline.body.data.events.length, 6);
      for (const item of ten) {
        assert.equal(item.response.headers.get('cache-control'), 'no-store');
        assert.equal(item.response.headers.get('x-request-id'), 'm2-h-e2e-request');
      }

      const unauthKnowledge = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge`, { accept: 'application/json' });
      const unauthPlan = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans`, { accept: 'application/json' });
      const forbiddenKnowledge = await getJson(`${baseUrl}/v1/projects/other-project/knowledge`, headers);
      const forbiddenPlan = await getJson(`${baseUrl}/v1/projects/other-project/test-plans`, headers);
      assert.equal(unauthKnowledge.response.status, 401);
      assert.equal(unauthPlan.response.status, 401);
      assert.equal(forbiddenKnowledge.response.status, 403);
      assert.equal(forbiddenPlan.response.status, 403);

      const knowledgeWrite = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge`, headers, { method: 'POST' });
      const planWrite = await getJson(`${baseUrl}/v1/projects/${projectId}/test-plans`, headers, { method: 'POST' });
      assert.equal(knowledgeWrite.response.status, 405);
      assert.equal(planWrite.response.status, 405);
      assert.equal(knowledgeWrite.response.headers.get('allow'), 'GET');
      assert.equal(planWrite.response.headers.get('allow'), 'GET');

      const liveBefore = await getJson(`${baseUrl}/live`, {});
      const readyBefore = await getJson(`${baseUrl}/ready`, {});
      assert.equal(liveBefore.response.status, 200);
      assert.equal(readyBefore.response.status, 200);
      postgresReady = false;
      const liveDuringPostgresOutage = await getJson(`${baseUrl}/live`, {});
      const readyDuringPostgresOutage = await getJson(`${baseUrl}/ready`, {});
      assert.equal(liveDuringPostgresOutage.response.status, 200);
      assert.equal(readyDuringPostgresOutage.response.status, 503);
      postgresReady = true;
      const readyAfterPostgresRecovery = await getJson(`${baseUrl}/ready`, {});
      assert.equal(readyAfterPostgresRecovery.response.status, 200);

      jwksAvailable = false;
      now += 2_000;
      const readyDuringJwksOutage = await getJson(`${baseUrl}/ready`, {});
      assert.equal(readyDuringJwksOutage.response.status, 503);
      jwksAvailable = true;
      const readyAfterJwksRecovery = await getJson(`${baseUrl}/ready`, {});
      assert.equal(readyAfterJwksRecovery.response.status, 200);

      const disclosed = JSON.stringify({
        responses: ten.map((item) => item.body),
        events: runtimeEvents.list(),
      });
      assert.equal(disclosed.includes(token), false);
      assert.equal(disclosed.includes(publicJwk.n), false);
      assert.equal(disclosed.includes(connectionString), false);
      assert(runtimeEvents.list().some((event) => event.type === 'SERVICE_NOT_READY'));
      assert(runtimeEvents.list().some((event) => event.type === 'SERVICE_READY'));

      await composition.service.stop('m2-h-e2e-complete');
    });
}

async function resetM2HData(pool) {
  await pool.query(`TRUNCATE TABLE
    ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_review_decisions,
    ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history,
    ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records,
    ${GOVERNANCE_POSTGRES_SCHEMA}.review_decisions,
    ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes,
    ${PROJECT_ACCESS_POSTGRES_SCHEMA}.membership_history,
    ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships,
    ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_history,
    ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects,
    ${POSTGRES_SCHEMA}.knowledge_history,
    ${POSTGRES_SCHEMA}.knowledge_records
    CASCADE`);
}

async function getJson(url, headers = {}, options = {}) {
  const response = await fetch(url, { ...options, headers });
  return { response, body: await response.json() };
}

function signJwt(privateKey, header, claims) {
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

function iso(value) { return new Date(value).toISOString(); }

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}
