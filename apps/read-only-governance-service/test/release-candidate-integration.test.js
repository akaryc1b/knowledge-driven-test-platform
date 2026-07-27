import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import {
  REVIEW_DECISION_SCHEMA_VERSION,
  createSnapshotEnvelope,
} from '@kdtp/knowledge-governance';
import { RemoteJwksProvider } from '@kdtp/governance-auth-oidc';
import {
  PostgresProjectDirectory,
  PostgresProjectMembershipStore,
} from '@kdtp/project-membership-postgres';
import {
  InMemoryRuntimeEventSink,
  createReadOnlyServiceComposition,
  loadServiceConfig,
} from '../src/index.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('M1 release E2E requires KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');

  test('M1-RC1 completes PostgreSQL, JWKS, OIDC, authorization and all read routes', { concurrency: false }, async (context) => {
    const now = Date.parse('2026-07-27T12:30:00.000Z');
    const issuer = 'https://release-issuer.example.test';
    const audience = 'kdtp-read-api';
    const projectId = 'release-acceptance';
    const subject = 'release-subject-001';
    const actor = 'release-auditor';
    const knowledgeId = 'PROJECT-RELEASE-001';
    const version = '1.0.0';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicJwk = {
      ...publicKey.export({ format: 'jwk' }),
      kid: 'm1-release-key-1',
      alg: 'RS256',
      use: 'sig',
      key_ops: ['verify'],
    };
    const jwksServer = createServer((request, response) => {
      if (request.url !== '/jwks') {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader('content-type', 'application/jwk-set+json');
      response.setHeader('cache-control', 'max-age=300');
      response.end(JSON.stringify({ keys: [publicJwk] }));
    });
    jwksServer.listen(0, '127.0.0.1');
    await once(jwksServer, 'listening');
    const jwksAddress = jwksServer.address();
    const pool = new Pool({ connectionString, max: 6 });
    const runtimeEvents = new InMemoryRuntimeEventSink();
    let composition = null;

    context.after(async () => {
      if (composition) await composition.service.stop('release-e2e-cleanup').catch(() => {});
      else await pool.end().catch(() => {});
      await closeServer(jwksServer);
    });

    const config = structuredClone(loadServiceConfig({
      KDTP_SERVICE_NAME: 'm1-release-candidate',
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
      cacheTtlMs: 60_000,
      maxCacheTtlMs: 60_000,
      clock: () => now,
    });
    composition = await createReadOnlyServiceComposition({
      config,
      pool,
      runtimeEvents,
      jwksProvider,
      clock: () => now,
      requestIdFactory: () => 'm1-k-generated-request',
    });

    await resetReleaseData(pool);
    const directory = new PostgresProjectDirectory({ pool });
    const memberships = new PostgresProjectMembershipStore({ pool });
    await directory.createProject({
      projectId,
      name: 'M1 Release Acceptance',
      actor: 'release-admin',
      at: iso(now - 60_000),
      reason: 'create release acceptance project',
    });
    await memberships.createMembership({
      projectId,
      subject: actor,
      roles: ['AUDITOR'],
      validFrom: iso(now - 60_000),
      validUntil: null,
      actor: 'release-admin',
      at: iso(now - 50_000),
      reason: 'grant read-only release auditor membership',
    });

    let record = await composition.components.registry.createDraft({
      knowledge: {
        schemaVersion: 'knowledge-rule/v1',
        id: knowledgeId,
        boundaryKey: 'release.read-only-acceptance',
        name: 'M1 只读发布验收规则',
        version,
        status: 'DRAFT',
        scope: { level: 'PROJECT', key: projectId },
        enforcement: 'mandatory',
        overridePolicy: 'deny',
        enabled: true,
        value: { routes: 5, writesAllowed: false },
        owner: 'quality-platform-team',
        source: 'M1-K release acceptance',
        riskLevel: 'critical',
      },
      actor: 'release-author',
      at: iso(now - 40_000),
      reason: 'create release acceptance knowledge',
    });
    record = await composition.components.registry.transition({
      id: knowledgeId,
      version,
      expectedRevision: record.revision,
      toStatus: 'REVIEWING',
      actor: 'release-author',
      at: iso(now - 30_000),
      reason: 'submit release acceptance knowledge',
    });
    await composition.components.reviewStore.append({
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      decisionId: 'decision:m1-k:release-0001',
      projectId,
      knowledgeKey: record.key,
      knowledgeId,
      version,
      reviewRevision: record.revision,
      decision: 'APPROVE',
      reviewer: 'release-reviewer',
      at: iso(now - 20_000),
      reason: 'approve read-only release evidence',
    });
    record = await composition.components.registry.transition({
      id: knowledgeId,
      version,
      expectedRevision: record.revision,
      toStatus: 'PUBLISHED',
      actor: 'release-publisher',
      at: iso(now - 10_000),
      reason: 'publish release acceptance knowledge',
    });

    const snapshot = buildKnowledgeSnapshot({
      context: {
        globalId: 'company',
        projectId,
        environmentId: 'release-candidate',
        releaseId: 'M1-RC1',
        domainPacks: [],
      },
      rules: [record.knowledge],
      resolution: [],
    });
    const envelope = createSnapshotEnvelope({
      projectId,
      snapshot,
      actor: 'release-publisher',
      at: iso(now - 5_000),
      reason: 'persist M1-RC1 release snapshot',
    });
    await composition.components.snapshotStore.save(envelope);

    const address = await composition.service.start();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = signJwt(privateKey, {
      alg: 'RS256',
      kid: publicJwk.kid,
    }, {
      iss: issuer,
      sub: subject,
      aud: audience,
      iat: Math.floor((now - 30_000) / 1000),
      exp: Math.floor((now + 300_000) / 1000),
    });
    const authorizedHeaders = {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-request-id': 'm1-k-release-e2e',
    };

    const list = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge?status=PUBLISHED&sortBy=id&direction=asc&limit=10`, authorizedHeaders);
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.items[0].key, record.key);
    assert.equal(list.response.headers.get('cache-control'), 'no-store');
    assert.equal(list.response.headers.get('x-request-id'), 'm1-k-release-e2e');

    const detail = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge/${knowledgeId}/versions/${version}`, authorizedHeaders);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.data.status, 'PUBLISHED');
    assert.equal(detail.body.data.value.writesAllowed, false);

    const timeline = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge/${knowledgeId}/versions/${version}/timeline`, authorizedHeaders);
    assert.equal(timeline.response.status, 200);
    assert(timeline.body.data.events.some((event) => event.kind === 'REVIEW_DECISION'));
    assert(timeline.body.data.events.some((event) => event.toStatus === 'PUBLISHED'));

    const snapshotList = await getJson(`${baseUrl}/v1/projects/${projectId}/snapshots?releaseId=M1-RC1`, authorizedHeaders);
    assert.equal(snapshotList.response.status, 200);
    assert.equal(snapshotList.body.data.items.length, 1);
    assert.equal(snapshotList.body.data.items[0].snapshotId, snapshot.snapshotId);

    const snapshotDetail = await getJson(`${baseUrl}/v1/projects/${projectId}/snapshots/${snapshot.snapshotId}`, authorizedHeaders);
    assert.equal(snapshotDetail.response.status, 200);
    assert.equal(snapshotDetail.body.data.digest, snapshot.digest);
    assert.equal(snapshotDetail.body.data.snapshot.rules.length, 1);

    const unauthenticated = await getJson(`${baseUrl}/v1/projects/${projectId}/knowledge`, { accept: 'application/json' });
    assert.equal(unauthenticated.response.status, 401);
    const forbidden = await getJson(`${baseUrl}/v1/projects/other-project/knowledge`, authorizedHeaders);
    assert.equal(forbidden.response.status, 403);

    const disclosed = JSON.stringify({
      list: list.body,
      detail: detail.body,
      timeline: timeline.body,
      snapshotList: snapshotList.body,
      snapshotDetail: snapshotDetail.body,
      events: runtimeEvents.list(),
    });
    assert.equal(disclosed.includes(token), false);
    assert.equal(disclosed.includes(publicJwk.n), false);
    assert(runtimeEvents.list().some((event) => event.type === 'AUTHENTICATION_EVENT'));

    await composition.service.stop('release-e2e-complete');
  });
}

async function resetReleaseData(pool) {
  await pool.query(`TRUNCATE TABLE
    kdtp_governance.review_decisions,
    kdtp_governance.snapshot_envelopes,
    kdtp_access.membership_history,
    kdtp_access.project_memberships,
    kdtp_access.project_history,
    kdtp_access.projects,
    kdtp_registry.knowledge_history,
    kdtp_registry.knowledge_records
    CASCADE`);
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers });
  return { response, body: await response.json() };
}

function signJwt(privateKey, header, claims) {
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

function iso(value) {
  return new Date(value).toISOString();
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}
