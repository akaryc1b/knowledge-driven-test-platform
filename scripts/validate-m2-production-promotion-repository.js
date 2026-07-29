import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { validateM2MainBranchCiObservation } from './validate-m2-main-branch-ci-evidence.js';
import { validateM2ProductionPromotion } from './validate-m2-production-promotion-entry.js';
import { validateM2R0MainCiClosure } from './validate-m2-r0-main-ci-closure.js';
import { validateM2R1BImageBinding } from './validate-m2-r1b-image-binding.js';

const ROOT = process.cwd();
const REQUIRED = Object.freeze([
  'docs/releases/M2-RC1-production-promotion.md',
  'docs/releases/M2-RC1-r0-main-ci-closure.md',
  'docs/releases/M2-RC1-ghcr-image-release.md',
  'docs/releases/M2-RC1-r1b-image-binding.md',
  'docs/03-roadmap/m2-rc1-production-promotion.md',
  'docs/04-governance/m2-production-promotion-acceptance-matrix.md',
  'docs/05-adr/ADR-0025-production-promotion-evidence.md',
  'docs/05-adr/ADR-0026-immutable-ghcr-release-image.md',
  'releases/m2/production-promotion.json',
  'releases/m2/main-branch-ci-observation.json',
  'releases/m2/r0-main-ci-closure.json',
  'releases/m2/release-image-evidence.json',
  'releases/m2/r1b-image-binding.json',
  'schemas/release/v3/m2-production-promotion.schema.json',
  'schemas/release/v3/m2-production-promotion-evidence.schema.json',
  'schemas/release/v3/m2-main-branch-ci-evidence.schema.json',
  'schemas/release/v3/m2-release-image-evidence.schema.json',
  'schemas/release/v3/m2-r1b-image-binding.schema.json',
  'schemas/release/v3/m2-r1b-image-binding-evidence.schema.json',
  'scripts/release-evidence-environment.js',
  'scripts/validate-m2-production-promotion.js',
  'scripts/validate-m2-production-promotion-r1b.js',
  'scripts/validate-m2-production-promotion-entry.js',
  'scripts/validate-m2-main-branch-ci-evidence.js',
  'scripts/validate-m2-r0-main-ci-closure.js',
  'scripts/validate-m2-r1b-image-binding.js',
  'scripts/collect-m2-main-branch-ci-evidence.js',
  'scripts/collect-m2-r0-main-ci-closure.js',
  'examples/m2-production-promotion.js',
  'apps/read-only-governance-service/test/m2-production-promotion.test.js',
  'apps/read-only-governance-service/test/m2-production-promotion-integration.test.js',
  'apps/read-only-governance-service/test/m2-r1b-image-binding.test.js',
  'apps/read-only-governance-service/test/m2-main-branch-ci-evidence.test.js',
  'apps/read-only-governance-service/test/m2-main-branch-ci-observation.test.js',
  'apps/read-only-governance-service/test/m2-r0-main-ci-closure.test.js',
  'apps/read-only-governance-service/test/release-evidence-environment.test.js',
  '.github/workflows/validation.yml',
  '.github/workflows/m2-r0-main-ci-closure.yml',
  '.github/workflows/m2-release-image.yml',
  '.github/workflows/m2-r1b-image-binding.yml',
]);

for (const path of REQUIRED) await stat(join(ROOT, path));

const catalog = JSON.parse(await readFile(join(ROOT, 'schemas/release/schema-catalog.json'), 'utf8'));
const expectedCatalog = {
  m2ProductionPromotion: 'm2-production-promotion/v1',
  m2ProductionPromotionEvidence: 'm2-production-promotion-evidence/v1',
  m2MainBranchCiEvidence: 'm2-main-branch-ci-evidence/v1',
  m2ReleaseImageEvidence: 'm2-release-image-evidence/v1',
  m2R1BImageBinding: 'm2-r1b-image-binding/v1',
  m2R1BImageBindingEvidence: 'm2-r1b-image-binding-evidence/v1',
};
for (const [key, expected] of Object.entries(expectedCatalog)) {
  if (catalog[key] !== expected) throw new Error(`Release catalog ${key} is invalid`);
}
for (const entry of [
  ['m2-production-promotion/v1', 'schemas/release/v3/m2-production-promotion.schema.json'],
  ['m2-production-promotion-evidence/v1', 'schemas/release/v3/m2-production-promotion-evidence.schema.json'],
  ['m2-main-branch-ci-evidence/v1', 'schemas/release/v3/m2-main-branch-ci-evidence.schema.json'],
  ['m2-release-image-evidence/v1', 'schemas/release/v3/m2-release-image-evidence.schema.json'],
  ['m2-r1b-image-binding/v1', 'schemas/release/v3/m2-r1b-image-binding.schema.json'],
  ['m2-r1b-image-binding-evidence/v1', 'schemas/release/v3/m2-r1b-image-binding-evidence.schema.json'],
]) {
  if (!catalog.schemas.some((item) => item.schemaVersion === entry[0] && item.path === entry[1])) {
    throw new Error(`Release catalog is missing ${entry[0]}`);
  }
}

const workflow = await readFile(join(ROOT, '.github/workflows/validation.yml'), 'utf8');
for (const requiredText of [
  'actions: read',
  'npm run validate:m2-main-ci-evidence',
  'node scripts/collect-m2-main-branch-ci-evidence.js',
  'name: m2-main-branch-ci-evidence',
  'npm run validate:m2-production-promotion',
  'npm run validate:m2-r1b-image-binding',
  'name: m2-r1b-image-binding-evidence',
]) {
  if (!workflow.includes(requiredText)) throw new Error(`Validation workflow is missing ${requiredText}`);
}
const closureWorkflow = await readFile(join(ROOT, '.github/workflows/m2-r0-main-ci-closure.yml'), 'utf8');
for (const requiredText of [
  'contents: read',
  'actions: read',
  'node scripts/collect-m2-r0-main-ci-closure.js',
  'name: m2-r0-main-ci-closure-evidence',
  'eligibleForClosure !== true',
]) {
  if (!closureWorkflow.includes(requiredText)) throw new Error(`R0 closure workflow is missing ${requiredText}`);
}
const bindingWorkflow = await readFile(join(ROOT, '.github/workflows/m2-r1b-image-binding.yml'), 'utf8');
for (const requiredText of [
  'workflow_dispatch:',
  'contents: read',
  'npm run validate:m2-r1b-image-binding',
  'name: m2-r1b-image-binding-evidence',
  'productionEligible !== false',
]) {
  if (!bindingWorkflow.includes(requiredText)) throw new Error(`R1-B binding workflow is missing ${requiredText}`);
}

const collector = await readFile(join(ROOT, 'scripts/collect-m2-main-branch-ci-evidence.js'), 'utf8');
for (const requiredText of [
  'event=push',
  "run.event === 'push'",
  "run.head_branch === 'main'",
  "run.conclusion === 'success'",
  'eligibleForClosure',
  'repository-validation-log',
  'm2-post-merge-acceptance-evidence',
]) {
  if (!collector.includes(requiredText)) throw new Error(`Main CI collector is missing ${requiredText}`);
}

const failedObservation = await validateM2MainBranchCiObservation();
if (failedObservation.run.conclusion !== 'failure' || failedObservation.eligibleForClosure !== false) {
  throw new Error('Original final main push failure observation is not preserved safely');
}
const closure = await validateM2R0MainCiClosure();
if (closure.run.conclusion !== 'success' || closure.eligibleForClosure !== true) {
  throw new Error('R0 main CI closure evidence is incomplete');
}

const bindingEvidence = await validateM2R1BImageBinding({
  generatedAt: '2026-07-29T10:15:00.000Z',
  commitSha: 'local',
  branch: 'agent/m2-rc1-r1b-immutable-image-binding',
});
if (bindingEvidence.decision.eligibleForProductionEvidenceBinding !== true
    || bindingEvidence.decision.productionEligible !== false
    || bindingEvidence.decision.remainingBlockers.length !== 4) {
  throw new Error('R1-B binding evidence decision is invalid');
}

const evidence = await validateM2ProductionPromotion({
  generatedAt: '2026-07-29T10:15:00.000Z',
  commitSha: 'local',
  branch: 'agent/m2-rc1-r1b-immutable-image-binding',
});
if (evidence.decision.productionEligible !== false) {
  throw new Error('M2 production promotion cannot be eligible while external blockers remain');
}
if (evidence.mainBranchFinalCi.status !== 'PASSED'
    || !evidence.decision.resolvedBlockers.includes('main-branch-final-ci-not-verified')
    || !evidence.decision.resolvedBlockers.includes('external-registry-digest-missing')
    || evidence.decision.openBlockers.includes('external-registry-digest-missing')) {
  throw new Error('M2 R1-B blocker state is inconsistent with immutable release evidence');
}
if (evidence.imageRelease.status !== 'PUBLISHED'
    || evidence.imageRelease.pullVerification.status !== 'PASSED'
    || !evidence.imageRelease.immutableReference.includes('@sha256:')) {
  throw new Error('M2 immutable image release evidence is incomplete');
}

console.log(`Validated M2 production promotion repository contract; historical main CI ${failedObservation.run.conclusion}; R0 closure ${closure.run.id}; R1-B release ${bindingEvidence.release.runId}; blockers ${evidence.decision.openBlockers.length}`);
