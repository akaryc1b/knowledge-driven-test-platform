import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

async function assertRepositoryPathMissing(relativePath) {
  await assert.rejects(
    stat(new URL(`../../../${relativePath}`, import.meta.url)),
    (error) => error?.code === 'ENOENT',
    `Unexpected runtime path exists: ${relativePath}`,
  );
}

function assertOrdered(text, fragments) {
  let previous = -1;
  for (const fragment of fragments) {
    const current = text.indexOf(fragment);
    assert.notEqual(current, -1, `Missing ordered fragment: ${fragment}`);
    assert.ok(current > previous, `Fragment is out of order: ${fragment}`);
    previous = current;
  }
}

test('M3-R4 permits P1 contracts and the P2 injected fake-only port', async () => {
  const adapterIndex = await readRepositoryFile(
    'packages/k6-api-adapter/src/index.js');
  assert.equal(adapterIndex.includes(
    "export * from './output-root-contracts.js';"), true);
  assert.equal(adapterIndex.includes(
    "export * from './trusted-output-root-port.js';"), true);
  for (const forbidden of [
    './governed-output-root.js',
    './output-root-allocator.js',
    './file-result-collector.js',
    'createGovernedOutputRoot',
    'allocateRealOutputRoot',
    'collectFileResults',
    'readResultFile',
  ]) {
    assert.equal(adapterIndex.includes(forbidden), false,
      `M3-R4 unexpectedly exports effectful runtime capability: ${forbidden}`);
  }

  await Promise.all([
    assertRepositoryPathMissing(
      'packages/k6-api-adapter/src/governed-output-root.js'),
    assertRepositoryPathMissing(
      'packages/k6-api-adapter/src/output-root-allocator.js'),
    assertRepositoryPathMissing(
      'packages/k6-api-adapter/src/file-result-collector.js'),
  ]);
});

test('M3-R4 preserves Node baseline and existing runtime implementation files', async () => {
  const packageDocument = JSON.parse(await readRepositoryFile('package.json'));
  assert.equal(packageDocument.type, 'module');
  assert.equal(packageDocument.engines.node, '>=22');
  assert.deepEqual(packageDocument.workspaces, ['apps/*', 'packages/*']);

  const index = await readRepositoryFile('packages/k6-api-adapter/src/index.js');
  assert.equal(index.includes("export * from './runtime-admission.js';"), true);
  assert.equal(index.includes(
    "export * from './local-process-boundary.js';"), true);
  assert.equal(index.includes(
    "export * from './process-execution-lifecycle.js';"), true);
});

test('M3-R4 R0 governance records preserve the exact predecessor and non-implementation boundary', async () => {
  const documents = await Promise.all([
    readRepositoryFile(
      'docs/04-governance/m3-r4-r0-governed-output-root-boundary-matrix.md'),
    readRepositoryFile(
      'docs/06-security/m3-r4-r0-governed-output-root-threat-model.md'),
    readRepositoryFile(
      'docs/05-adr/ADR-0035-governed-output-root-contract-first.md'),
    readRepositoryFile(
      'docs/02-development/m3-r4-r0-governed-output-root-handoff.md'),
    readRepositoryFile('docs/m3-r4-r0-index.md'),
  ]);
  const combined = documents.join('\n');

  for (const claim of [
    '6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa',
    'finalManifestRun=31151845526',
    'finalManifestArtifact=8983613200',
    'm3R3FinalClosureReverified=true',
    'm3R4Started=true',
    'm3R4R0Started=true',
    'm3R4ProductImplementationStarted=false',
    'governedOutputRootDefined=false',
    'governedOutputRootImplemented=false',
    'outputDirectoryCreated=false',
    'fileResultCollectionSupported=false',
    'fileResultCollectionImplemented=false',
    'sourceBundleRemainsImmutable=true',
    'callerPathAccepted=false',
    'arbitraryFileReadEnabled=false',
    'securityDashboardsEnumerable=false',
    'zeroAlertClaimMade=false',
    'nextRequiredSlice=M3-R4-R0',
  ]) {
    assert.equal(combined.includes(claim), true,
      `Missing M3-R4 R0 frozen claim: ${claim}`);
  }
});

test('M3-R4 keeps the safe slice order and starts only P2', async () => {
  const roadmap = await readRepositoryFile(
    'docs/03-roadmap/m3-r4-governed-output-root.md');
  const r0Handoff = await readRepositoryFile(
    'docs/02-development/m3-r4-r0-governed-output-root-handoff.md');
  assertOrdered(roadmap, [
    '**R0 — Rebaseline and boundary freeze**',
    '**P1 — Versioned output-root contracts**',
    '**P2 — Injected trusted root port**',
    '**P3 — Bounded result collector**',
    '**P4 — Fault, security and compatibility acceptance**',
    '**G1–G4 — Formal acceptance and exact-main closure**',
  ]);
  assert.equal(r0Handoff.includes('m3R4P1Started=false'), true);
  assert.equal(roadmap.includes('slice=M3-R4-P2'), true);
  assert.equal(roadmap.includes('m3R4P1ExactHeadAcceptanceComplete=true'), true);
  assert.equal(roadmap.includes('m3R4P2Started=true'), true);
  assert.equal(roadmap.includes('m3R4P3Started=false'), true);
});

test('M3-R4 R0 matrix covers path, object, race, resource and disclosure threats', async () => {
  const matrix = await readRepositoryFile(
    'docs/04-governance/m3-r4-r0-governed-output-root-boundary-matrix.md');
  for (const boundary of [
    'OWNERSHIP',
    'SEPARATION',
    'IDENTITY',
    'CALLER_PATH_INJECTION',
    'TRAVERSAL',
    'SYMLINK',
    'HARDLINK_OR_ALIAS',
    'SPECIAL_FILE',
    'TOCTOU',
    'ALLOWLIST',
    'OVERSIZE',
    'PARSER_BOMB',
    'PARTIAL_WRITE',
    'STALE_REPLAY',
    'CLEANUP_RACE',
    'HOST_PATH_DISCLOSURE',
    'RAW_OUTPUT_DISCLOSURE',
    'SOURCE_BUNDLE_MUTATION',
    'CROSS_EXECUTION_COLLISION',
    'CI_SCOPE_ESCALATION',
  ]) {
    assert.equal(matrix.includes(`| ${boundary} |`), true,
      `Missing output-root boundary: ${boundary}`);
  }
});
