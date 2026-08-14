import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_OUTPUT_ROOT_LIMITS,
  collectK6BoundedFileResult,
  validateK6OutputArtifactInspectionRequest,
} from '../src/index.js';
import {
  boundedFileResultCollectorFixture,
  createBoundedResultCollectorFake,
  createMonotonicClock,
  encodeK6SummaryJson,
} from './bounded-file-result-collector-test-helpers.js';
import {
  ACCEPTED_M3_R4_P3,
  M3_R4_P4_DECISION,
  M3_R4_P4_LINUX_BOUNDARY,
  M3_R4_P4_SAFETY_BOUNDARY,
} from '../../../scripts/m3-r4-p4/constants.js';
import {
  validateM3R4P4FaultSecurityCompatibility,
} from '../../../scripts/validate-m3-r4-p4-fault-security-compatibility.js';

const PRODUCT_PATHS = Object.freeze([
  'packages/k6-api-adapter/src/bounded-file-result-collector.js',
  'packages/k6-api-adapter/src/bounded-json-result-payload.js',
  'packages/k6-api-adapter/src/bounded-result-collector-contracts.js',
  'packages/k6-api-adapter/src/bounded-result-collector-definitions.js',
  'packages/k6-api-adapter/src/bounded-result-collector-validation.js',
  'packages/k6-api-adapter/src/bounded-result-collector-predecessor.js',
]);

const PROHIBITED_RUNTIME_PATHS = Object.freeze([
  'packages/k6-api-adapter/src/governed-output-root.js',
  'packages/k6-api-adapter/src/output-root-allocator.js',
  'packages/k6-api-adapter/src/filesystem-output-root-port.js',
  'packages/k6-api-adapter/src/real-output-root-port.js',
  'packages/k6-api-adapter/src/file-result-collector.js',
  'packages/k6-api-adapter/src/filesystem-result-collector.js',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redigest(value, field) {
  const claims = clone(value);
  delete claims[field];
  value[field] = sha256(claims);
  return value;
}

function exactObjectBytes(byteLength) {
  const prefix = '{"padding":"';
  const suffix = '"}';
  assert(byteLength >= prefix.length + suffix.length);
  return encodeK6SummaryJson(
    `${prefix}${'x'.repeat(byteLength - prefix.length - suffix.length)}${suffix}`,
  );
}

function nestedObjectBytes(depth) {
  let value = '0';
  for (let index = 0; index < depth; index += 1) {
    value = `{"a":${value}}`;
  }
  return encodeK6SummaryJson(value);
}

function compatibilityProduct(fixture) {
  return {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
    inspectionRequest: fixture.inspectionRequest,
    inspectionReceipt: fixture.inspectionReceipt,
    payloadRequest: fixture.payloadRequest,
    payloadReceipt: fixture.payloadReceipt,
    boundedFileResult: fixture.result,
  };
}

async function collect(options = {}) {
  const base = options.base ?? await boundedFileResultCollectorFixture();
  return collectK6BoundedFileResult({
    boundedResultCollectorPort: options.port
      ?? createBoundedResultCollectorFake(options.fakeOptions),
    monotonicClock: options.clock ?? createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  });
}

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

test('P4 rejects caller path, traversal, absolute, URI and mixed-separator substitutions', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const bindings = {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    p2Bindings: fixture.p2Bindings,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
  };
  for (const relativePath of [
    '', '../summary.json', 'outputs/../summary.json', '/tmp/summary.json',
    'C:\\private\\summary.json', 'file:///tmp/summary.json',
    'outputs\\summary.json', 'outputs//summary.json',
    'outputs/%2e%2e/summary.json', './outputs/summary.json',
  ]) {
    const forged = clone(fixture.inspectionRequest);
    forged.relativePath = relativePath;
    redigest(forged, 'requestDigest');
    assert.throws(
      () => validateK6OutputArtifactInspectionRequest(forged, bindings),
      /allow-list|relativePath|mismatch|inspection request/u,
      relativePath,
    );
  }
});

test('P4 rejects symbolic-link, hard-link, special-file and directory attestations', async () => {
  const base = await boundedFileResultCollectorFixture();
  const mutations = [
    (receipt) => { receipt.symbolicLink = true; },
    (receipt) => { receipt.hardLink = true; },
    (receipt) => { receipt.specialFile = true; },
    (receipt) => {
      receipt.objectType = 'DIRECTORY';
      receipt.regularFileAttested = false;
    },
  ];
  for (const mutation of mutations) {
    const port = createBoundedResultCollectorFake({
      mutateInspectionReceipt(receipt) {
        mutation(receipt);
        return redigest(receipt, 'receiptDigest');
      },
    });
    assert.throws(() => collectK6BoundedFileResult({
      boundedResultCollectorPort: port,
      monotonicClock: createMonotonicClock(),
      p2Bindings: base.p2Bindings,
    }), /unsupported object|inspection receipt/u);
  }
});

test('P4 rejects an unstable object attestation before payload delivery', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutateInspectionReceipt(receipt) {
      receipt.stableObjectAttested = false;
      return redigest(receipt, 'receiptDigest');
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /unsupported object|inspection receipt/u);
});

test('P4 rejects a stale artifact handle even after receipt redigest', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutateInspectionReceipt(receipt) {
      receipt.artifactHandle = 'k6artifact-handle-aaaaaaaaaaaaaaaaaaaa';
      return redigest(receipt, 'receiptDigest');
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /artifact|inspection receipt|mismatch/u);
});

test('P4 accepts the exact byte limit', async () => {
  const bytes = exactObjectBytes(K6_OUTPUT_ROOT_LIMITS.maxFileBytes);
  const result = await collect({ fakeOptions: { bytes } });
  assert.equal(result.result.artifact.byteLength,
    K6_OUTPUT_ROOT_LIMITS.maxFileBytes);
  assert.equal(result.result.artifact.maxDepthObserved, 1);
});

test('P4 rejects one byte over the exact byte limit', async () => {
  const bytes = exactObjectBytes(K6_OUTPUT_ROOT_LIMITS.maxFileBytes + 1);
  await assert.rejects(async () => collect({ fakeOptions: { bytes } }),
    /rejected|byte limit|size/u);
});

test('P4 accepts the exact JSON depth', async () => {
  const result = await collect({
    fakeOptions: { bytes: nestedObjectBytes(K6_OUTPUT_ROOT_LIMITS.maxJsonDepth) },
  });
  assert.equal(result.result.artifact.maxDepthObserved,
    K6_OUTPUT_ROOT_LIMITS.maxJsonDepth);
});

test('P4 rejects one level over the exact JSON depth', async () => {
  await assert.rejects(async () => collect({
    fakeOptions: {
      bytes: nestedObjectBytes(K6_OUTPUT_ROOT_LIMITS.maxJsonDepth + 1),
    },
  }), /depth limit/u);
});

test('P4 rejects an escaped duplicate key after JSON string decoding', async () => {
  await assert.rejects(async () => collect({
    fakeOptions: { bytes: encodeK6SummaryJson('{"a":1,"\\u0061":2}') },
  }), /duplicate object key/u);
});

test('P4 accepts the exact duration limit', async () => {
  const result = await collect({
    clock: createMonotonicClock([
      1_000, 1_000 + K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs,
    ]),
  });
  assert.equal(result.result.collectionDurationMs,
    K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs);
});

test('P4 rejects one millisecond over and a backwards monotonic clock', async () => {
  await assert.rejects(async () => collect({
    clock: createMonotonicClock([
      1_000, 1_001 + K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs,
    ]),
  }), /duration limit/u);
  await assert.rejects(async () => collect({
    clock: createMonotonicClock([5, 4]),
  }), /moved backwards/u);
});

test('P4 rejects same-length payload replacement when receipt metadata is stale', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutatePayloadBytes(bytes) {
      const replacement = Uint8Array.from(bytes);
      replacement[replacement.length - 2] ^= 1;
      return replacement;
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /do not match inspection and receipt metadata/u);
});

test('P4 sanitizes all injected failures and clock failures', async () => {
  const base = await boundedFileResultCollectorFixture();
  const secretText = 'SENSITIVE_VALUE_DO_NOT_DISCLOSE';
  const cases = [
    [createBoundedResultCollectorFake({ sealError: new Error(secretText) }),
      createMonotonicClock(), 'K6_OUTPUT_ROOT_SEAL_REJECTED'],
    [createBoundedResultCollectorFake({ inspectionError: new Error(secretText) }),
      createMonotonicClock(), 'K6_OUTPUT_ARTIFACT_INSPECTION_REJECTED'],
    [createBoundedResultCollectorFake({ payloadError: new Error(secretText) }),
      createMonotonicClock(), 'K6_OUTPUT_ARTIFACT_PAYLOAD_REJECTED'],
    [createBoundedResultCollectorFake(), {
      nowMs() { throw new Error(secretText); },
    }, 'K6_OUTPUT_RESULT_CLOCK_REJECTED'],
  ];
  for (const [port, clock, code] of cases) {
    assert.throws(() => collectK6BoundedFileResult({
      boundedResultCollectorPort: port,
      monotonicClock: clock,
      p2Bindings: base.p2Bindings,
    }), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.message.includes(secretText), false);
      assert.equal(JSON.stringify(error).includes(secretText), false);
      return true;
    });
  }
});

test('P4 preserves metadata-only disclosure and the acceptance-only decision', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const serialized = JSON.stringify(compatibilityProduct(fixture));
  for (const forbidden of [
    '/private/', 'C:\\private\\', 'Authorization', 'Bearer ',
    '"passes"', '"fails"', 'SENSITIVE_VALUE_DO_NOT_DISCLOSE',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.equal(M3_R4_P4_DECISION.realFilesystemCollectorImplemented, false);
  assert.equal(M3_R4_P4_DECISION.nextRequiredSlice, 'M3-R4-G1');
  assert.equal(M3_R4_P4_LINUX_BOUNDARY.implementationAuthorized, false);
  assert.equal(Object.values(M3_R4_P4_SAFETY_BOUNDARY)
    .every((value) => value === false), true);
});

test('P4 preserves the accepted P3 compatibility product digest', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  assert.equal(sha256(compatibilityProduct(fixture)),
    '03b2ac5c2c3ad035744426e9ac6a54f800381b6e9e72d9bfc90553f5938a6ac0');
  assert.equal(sha256(compatibilityProduct(fixture)),
    ACCEPTED_M3_R4_P3.compatibilityProductDigest);
});

test('P4 production products remain free of filesystem, process, network and environment effects', async () => {
  const source = (await Promise.all(PRODUCT_PATHS.map(readRepositoryFile)))
    .join('\n');
  for (const forbidden of [
    'node:fs', 'node:path', 'node:child_process', 'node:http', 'node:https',
    'node:net', 'node:tls', 'node:dgram', 'process.env', 'mkdir(',
    'readFile(', 'writeFile(', 'readdir(', 'realpath(', 'spawn(',
    'execFile(', 'execFileSync(', 'execSync(',
  ]) assert.equal(source.includes(forbidden), false, forbidden);
  for (const path of PROHIBITED_RUNTIME_PATHS) {
    await assert.rejects(
      stat(new URL(`../../../${path}`, import.meta.url)),
      (error) => error?.code === 'ENOENT',
      path,
    );
  }
});

test('P4 permanent repository Validator emits closed acceptance Evidence', async () => {
  const evidence = await validateM3R4P4FaultSecurityCompatibility({
    generatedAt: '2026-08-14T04:00:00.000Z',
    branch: 'local',
    commitSha: 'local',
    testResults: {
      focusedNode22: { total: 17, passed: 17, skipped: 0, failed: 0 },
      focusedNode24: { total: 17, passed: 17, skipped: 0, failed: 0 },
      k6ApiAdapter: { total: 1, passed: 1, skipped: 0, failed: 0 },
      fullNode: { total: 1, passed: 1, skipped: 0, failed: 0 },
      repositoryValidator: { status: 'success' },
      scopeGuard: { status: 'success' },
      compatibilityProductDigest:
        ACCEPTED_M3_R4_P3.compatibilityProductDigest,
    },
  });
  assert.equal(evidence.schemaVersion, 'm3-r4-output-root-p4-evidence/v1');
  assert.equal(evidence.acceptedP3.headSha, ACCEPTED_M3_R4_P3.headSha);
  assert.equal(evidence.acceptanceProfile.implementationStatus,
    'ACCEPTANCE_ONLY');
  assert.equal(evidence.decision.faultSecurityCompatibilityAccepted, true);
  assert.equal(evidence.decision.repositoryBlockers.length, 0);
  assert.match(evidence.evidenceDigest, /^[a-f0-9]{64}$/u);
});
