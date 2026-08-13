import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import {
  collectK6BoundedFileResult,
  createK6BoundedResultCollectorPortDescriptor,
  validateK6BoundedResultCollectorPortDescriptor,
} from '../src/index.js';
import {
  boundedFileResultCollectorFixture,
  createBoundedResultCollectorFake,
  createMonotonicClock,
  encodeK6SummaryJson,
} from './bounded-file-result-collector-test-helpers.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redigest(value, field) {
  const copy = clone(value);
  delete copy[field];
  value[field] = sha256(copy);
}

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

test('P3 rejects a missing or incomplete injected collector port', async () => {
  const { p2Bindings } = await boundedFileResultCollectorFixture();
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: null,
    monotonicClock: createMonotonicClock(),
    p2Bindings,
  }), /injected BoundedResultCollectorPort/u);
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: {
      descriptor: createK6BoundedResultCollectorPortDescriptor(),
      sealRoot() {},
      inspectArtifact() {},
    },
    monotonicClock: createMonotonicClock(),
    p2Bindings,
  }), /must seal, inspect and provide a payload/u);
});

test('P3 rejects a self-redigested collector capability escalation', () => {
  const descriptor = clone(createK6BoundedResultCollectorPortDescriptor());
  descriptor.capabilities.accessRealFilesystem = true;
  redigest(descriptor, 'portDigest');
  assert.throws(() => validateK6BoundedResultCollectorPortDescriptor(descriptor),
    /fake-only|widens|mismatch/u);
});

test('P3 rejects seal receipts that disclose a host path', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutateSealReceipt(receipt) {
      receipt.hostPath = '/private/output-root';
      redigest(receipt, 'receiptDigest');
      return receipt;
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /fields|seal receipt/u);
});

test('P3 rejects symbolic-link, hard-link and special-file attestations', async () => {
  const base = await boundedFileResultCollectorFixture();
  for (const mutation of [
    (receipt) => { receipt.symbolicLink = true; },
    (receipt) => { receipt.hardLink = true; },
    (receipt) => { receipt.specialFile = true; },
  ]) {
    const port = createBoundedResultCollectorFake({
      mutateInspectionReceipt(receipt) {
        mutation(receipt);
        redigest(receipt, 'receiptDigest');
        return receipt;
      },
    });
    assert.throws(() => collectK6BoundedFileResult({
      boundedResultCollectorPort: port,
      monotonicClock: createMonotonicClock(),
      p2Bindings: base.p2Bindings,
    }), /unsupported object|inspection receipt/u);
  }
});

test('P3 rejects a non-regular or unstable object attestation', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutateInspectionReceipt(receipt) {
      receipt.objectType = 'DIRECTORY';
      receipt.regularFileAttested = false;
      receipt.stableObjectAttested = false;
      redigest(receipt, 'receiptDigest');
      return receipt;
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /unsupported object|inspection receipt/u);
});

test('P3 rejects a payload larger than the exact per-file limit', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    bytes: new Uint8Array(1_048_577),
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), (error) => {
    assert.equal(error.code, 'K6_OUTPUT_ARTIFACT_INSPECTION_REJECTED');
    return true;
  });
});

test('P3 rejects payload responses with unexpected fields', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutatePayloadResponse(response) {
      return { ...response, hostPath: '/private/result.json' };
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /return only bytes and a receipt/u);
});

test('P3 rejects transient bytes that do not match the receipt digest', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    mutatePayloadBytes(bytes) {
      const changed = Uint8Array.from(bytes);
      changed[0] ^= 1;
      return changed;
    },
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /do not match inspection and receipt metadata/u);
});

test('P3 rejects a UTF-8 BOM', async () => {
  const base = await boundedFileResultCollectorFixture();
  const body = encodeK6SummaryJson('{"ok":true}');
  const bytes = new Uint8Array(3 + body.byteLength);
  bytes.set([0xef, 0xbb, 0xbf], 0);
  bytes.set(body, 3);
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake({ bytes }),
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /BOM is not allowed/u);
});

test('P3 rejects malformed UTF-8', async () => {
  const base = await boundedFileResultCollectorFixture();
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake({
      bytes: Uint8Array.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0xc3, 0x28, 0x7d]),
    }),
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /not valid UTF-8/u);
});

test('P3 rejects duplicate JSON object keys', async () => {
  const base = await boundedFileResultCollectorFixture();
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake({
      bytes: encodeK6SummaryJson('{"a":1,"a":2}'),
    }),
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /duplicate object key/u);
});

test('P3 rejects JSON nesting beyond the exact depth limit', async () => {
  const base = await boundedFileResultCollectorFixture();
  let nested = '0';
  for (let index = 0; index < 33; index += 1) nested = `{"a":${nested}}`;
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake({
      bytes: encodeK6SummaryJson(nested),
    }),
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), /exceeds the depth limit/u);
});

test('P3 rejects a collection deadline violation', async () => {
  const base = await boundedFileResultCollectorFixture();
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake(),
    monotonicClock: createMonotonicClock([1_000, 11_001]),
    p2Bindings: base.p2Bindings,
  }), /exceeded its duration limit/u);
});

test('P3 rejects a monotonic clock that moves backwards', async () => {
  const base = await boundedFileResultCollectorFixture();
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake(),
    monotonicClock: createMonotonicClock([5, 4]),
    p2Bindings: base.p2Bindings,
  }), /moved backwards/u);
});

test('P3 rejects stale self-redigested P2 boundary Evidence', async () => {
  const base = await boundedFileResultCollectorFixture();
  const forged = clone(base.p2Bindings.boundaryEvidence);
  forged.evidenceId = 'k6output-root-port-aaaaaaaaaaaaaaaaaaaa';
  redigest(forged, 'evidenceDigest');
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: createBoundedResultCollectorFake(),
    monotonicClock: createMonotonicClock(),
    p2Bindings: { ...base.p2Bindings, boundaryEvidence: forged },
  }), /boundary Evidence|accepted chain|mismatch/u);
});

test('P3 sanitizes injected port failures without preserving secret text', async () => {
  const base = await boundedFileResultCollectorFixture();
  const port = createBoundedResultCollectorFake({
    payloadError: new Error('SECRET_HOST_PATH=/private/result.json'),
  });
  assert.throws(() => collectK6BoundedFileResult({
    boundedResultCollectorPort: port,
    monotonicClock: createMonotonicClock(),
    p2Bindings: base.p2Bindings,
  }), (error) => {
    assert.equal(error.code, 'K6_OUTPUT_ARTIFACT_PAYLOAD_REJECTED');
    assert.equal(JSON.stringify(error).includes('SECRET_HOST_PATH'), false);
    return true;
  });
});

test('P3 public products disclose no host path, PID, raw JSON or credential', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const serialized = JSON.stringify({
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
    inspectionRequest: fixture.inspectionRequest,
    inspectionReceipt: fixture.inspectionReceipt,
    payloadRequest: fixture.payloadRequest,
    payloadReceipt: fixture.payloadReceipt,
    result: fixture.result,
  });
  for (const forbidden of [
    '/private/output-root',
    'C:\\private\\output-root',
    'Authorization',
    'Bearer ',
    'SECRET_HOST_PATH',
    '"passes"',
    '"fails"',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('P3 production modules contain no filesystem, process or environment primitive', async () => {
  const sources = await Promise.all([
    'packages/k6-api-adapter/src/bounded-file-result-collector.js',
    'packages/k6-api-adapter/src/bounded-json-result-payload.js',
    'packages/k6-api-adapter/src/bounded-result-collector-contracts.js',
    'packages/k6-api-adapter/src/bounded-result-collector-definitions.js',
    'packages/k6-api-adapter/src/bounded-result-collector-validation.js',
    'packages/k6-api-adapter/src/bounded-result-collector-predecessor.js',
  ].map(readRepositoryFile));
  const source = sources.join('\n');
  for (const forbidden of [
    'node:fs',
    'node:path',
    'node:child_process',
    'process.env',
    'mkdir(',
    'readFile(',
    'writeFile(',
    'readdir(',
    'realpath(',
    'spawn(',
    'exec(',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
