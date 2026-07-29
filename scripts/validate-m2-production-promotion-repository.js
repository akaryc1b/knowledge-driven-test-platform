import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { validateM2MainBranchCiObservation } from './validate-m2-main-branch-ci-evidence.js';
import { validateM2ProductionPromotion } from './validate-m2-production-promotion-entry.js';
import { validateM2R0MainCiClosure } from './validate-m2-r0-main-ci-closure.js';

const ROOT = process.cwd();
const REQUIRED = Object.freeze([
  'docs/releases/M2-RC1-production-promotion.md',
  'docs/releases/M2-RC1-r0-main-ci-closure.md',
  'docs/03-roadmap/m2-rc1-production-promotion.md',
  'docs/04-governance/m2-production-promotion-acceptance-matrix.md',
  'docs/05-adr/ADR-0025-production-promotion-evidence.md',
  'releases/m2/production-promotion.json',
  'releases/m2/main-branch-ci-observation.json',
  'releases/m2/r0-main-ci-closure.json',
  'schemas/release/v3/m2-production-promotion.schema.json',
  'schemas/release/v3/m2-production-promotion-evidence.schema.json',
  'schemas/release/v3/m2-main-branch-ci-evidence.schema.json',
  'scripts/release-evidence-environment.js',
  'scripts/validate-m2-production-promotion.js',
  'scripts/validate-m2-production-promotion-entry.js',
  'scripts/validate-m2-main-branch-ci-evidence.js',
  'scripts/validate-m2-r0-main-ci-closure.js',
  'scripts/collect-m2-main-branch-ci-evidence.js',
  'scripts/collect-m2-r0-main-ci-closure.js',
  'examples/m2-production-promotion.js',
  'apps/read-only-governance-service/test/m2-production-promotion.test.js',
  'apps/read-only-governance-service/test/m2-production-promotion-integration.test.js',
  'apps/read-only-governance-service/test/m2-main-branch-ci-evidence.test.js',
  'apps/read-only-governance-service/test/m2-main-branch-ci-observation.test.js',
  'apps/read-only-governance-service/test/m2-r0-main-ci-closure.test.js',
  'apps/read-only-governance-service/test/release-evidence-environment.test.js',
  '.github/workflows/validation.yml',
  '.github/workflows/m2-r0-main-ci-closure.yml',
]);

for (const path of REQUIRED) await stat(join(ROOT, path));

const catalog = JSON.parse(await readFile(join(ROOT, 'schemas/release/schema-catalog.json'), 'utf8'));
const expectedCatalog = {
  m2ProductionPromotion: 'm2-production-promotion/v1',
  m2ProductionPromotionEvidence: 'm2-production-promotion-evidence/v1',
  m2MainBranchCiEvidence: 'm2-main-branch-ci-evidence/v1',
};
for (const [key, expected] of Object.entries(expectedCatalog)) {
  if (catalog[key] !== expected) throw new Error(`Release catalog ${key} is invalid`);
}
for (const entry of [
  ['m2-production-promotion/v1', 'schemas/release/v3/m2-production-promotion.schema.json'],
  ['m2-production-promotion-evidence/v1', 'schemas/release/v3/m2-production-promotion-evidence.schema.json'],
  ['m2-main-branch-ci-evidence/v1', 'schemas/release/v3/m2-main-branch-ci-evidence.schema.json'],
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

const evidence = await validateM2ProductionPromotion({
  generatedAt: '2026-07-29T05:10:00.000Z',
  commitSha: 'local',
  branch: 'agent/m2-rc1-r0-main-ci-closure',
});
if (evidence.decision.productionEligible !== false) {
  throw new Error('M2 production promotion cannot be eligible while external blockers remain');
}
if (evidence.mainBranchFinalCi.status !== 'PASSED'
    || !evidence.decision.resolvedBlockers.includes('main-branch-final-ci-not-verified')
    || evidence.decision.openBlockers.includes('main-branch-final-ci-not-verified')) {
  throw new Error('M2 main CI blocker is inconsistent with closure evidence');
}
if (!evidence.decision.openBlockers.includes('external-registry-digest-missing')) {
  throw new Error('M2 Registry digest blocker was closed without R1-A evidence');
}

console.log(`Validated M2 production promotion repository contract; historical main CI ${failedObservation.run.conclusion}; R0 closure ${closure.run.id}; promotion ${evidence.mainBranchFinalCi.status}; blockers ${evidence.decision.openBlockers.length}`);
