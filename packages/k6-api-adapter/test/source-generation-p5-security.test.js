import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clone, loadAcceptedP5Fixture, rejectExecutableMaterial, scanSensitiveValues,
  validateStorePath, verifyAcceptedP4, verifyStore,
} from './p5-test-helpers.js';

const executableFixtures = [
  'ev' + 'al(input)', 'new ' + 'Function("return 1")', 'node:' + 'vm',
  'vm.' + 'runInContext(source)', 'req' + 'uire("fs")', 'im' + 'port("x")',
  'child_' + 'process', 'process' + '.env.HOME', 'async ' + 'function callback() {}',
  'function' + '* generator() {}', 'bash ' + '-c whoami', 'runtime' + 'Arguments',
  'caller' + 'Modules', 'module' + 'Wildcard', '`template ${value}`',
];
const pathFixtures = [
  '../escape', '/etc/passwd', 'file:///tmp/a', 'C:\\Temp\\a',
  '\\\\server\\share', `a${String.fromCharCode(0)}b`, '%2e%2e/escape',
  'a/../b', './source/main.js', 'https://example.invalid/a',
];

test('P5 rejects executable material without widening product contracts', () => {
  for (const value of executableFixtures) {
    assert.throws(() => rejectExecutableMaterial({ value }), /executable|template literal/i);
  }
  assert.doesNotThrow(() => rejectExecutableMaterial({ method: 'GET', path: '/health' }));
});

test('P5 rejects traversal, absolute, URI, drive, UNC, NUL and encoded paths', () => {
  for (const path of pathFixtures) assert.throws(() => validateStorePath(path), /path/i);
  for (const path of ['bundle.json', 'metadata/provenance.json', 'source/main.js']) {
    assert.equal(validateStorePath(path), path);
  }
});

test('P5 detects safely constructed credential-shaped values', () => {
  const fromCodes = (...codes) => String.fromCharCode(...codes);
  const fixtures = [
    fromCodes(65,117,116,104,111,114,105,122,97,116,105,111,110,58,32,66,97,115,105,99,32,97,98,99,100,101,102,103,104),
    fromCodes(83,101,116,45,67,111,111,107,105,101,58,32,115,105,100,61,120),
    fromCodes(112,97,115,115,119,111,114,100,61,101,120,97,109,112,108,101),
    fromCodes(97,112,105,75,101,121,58,32,101,120,97,109,112,108,101),
    fromCodes(66,101,97,114,101,114,32,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112),
    fromCodes(112,111,115,116,103,114,101,115,113,108,58,47,47,117,115,101,114,58,112,97,115,115,64,101,120,97,109,112,108,101,46,105,110,118,97,108,105,100,47,100,98),
    fromCodes(45,45,45,45,45,66,69,71,73,78,32,79,80,69,78,83,83,72,32,80,82,73,86,65,84,69,32,75,69,89,45,45,45,45,45),
  ];
  for (const value of fixtures) assert.throws(() => scanSensitiveValues({ value }), /credential-shaped/i);
});

test('P5 scans every accepted output and persisted Store value', async () => {
  const fixture = await loadAcceptedP5Fixture();
  assert.doesNotThrow(() => scanSensitiveValues({
    generatedSource: fixture.receipt.publication.bundle.files.find((f) => f.path === 'source/main.js').content,
    sourceArtifact: fixture.receipt.publication.bundle.files.find((f) =>
      f.path === 'metadata/source-artifact.json').content,
    validationEvidence: fixture.receipt.publication.bundle.files.find((f) =>
      f.path === 'metadata/source-validation-evidence.json').content,
    p3Evidence: fixture.receipt.publication.bundle.files.find((f) =>
      f.path === 'metadata/p3-evidence.json').content,
    bundle: fixture.receipt.publication.bundle,
    manifest: fixture.receipt.publication.bundle.manifest,
    provenance: fixture.receipt.publication.bundle.provenance,
    receipt: fixture.receipt.publication.receipt,
    publicationEvidence: fixture.receipt.publication.publicationEvidence,
    p4Evidence: fixture.evidence,
    persistedStore: fixture.receipt.store,
  }));
});

test('P5 rejects extra, missing, renamed and content-drifted Store files', async () => {
  const fixture = await loadAcceptedP5Fixture();
  for (const mutate of [
    (r) => r.store.files.push({ path: 'extra.txt', byteLength: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', content: '' }),
    (r) => { r.store.files = r.store.files.filter((f) => f.path !== 'manifest.json'); },
    (r) => { r.store.files[0].path = 'caller-selected.js'; },
    (r) => { r.store.files.find((f) => f.path === 'source/main.js').sha256 = '0'.repeat(64); },
  ]) {
    const receipt = clone(fixture.receipt); mutate(receipt);
    assert.throws(() => verifyStore(receipt), /Store|digest|file set|Missing/i);
  }
});

test('P5 public receipt, evidence and logical URI do not leak host paths', async () => {
  const fixture = await loadAcceptedP5Fixture();
  const publicObjects = JSON.stringify({ evidence: fixture.evidence,
    publication: fixture.receipt.publication });
  assert.doesNotMatch(publicObjects, /(?:\/tmp\/|\/home\/|\/Users\/|[A-Za-z]:\\)/u);
  assert.match(fixture.receipt.publication.receipt.storage.logicalUri,
    /^kdtp-source-bundle:\/\/sha256\/[a-f0-9]{64}$/u);
  const receipt = clone(fixture.receipt);
  receipt.publication.receipt.storage.logicalUri = 'file:///tmp/leak';
  assert.throws(() => verifyAcceptedP4({ receipt,
    receiptRaw: `${JSON.stringify(receipt, null, 2)}\n`, evidence: fixture.evidence,
    evidenceRaw: fixture.evidenceRaw }), /receipt|digest|binding/i);
});
