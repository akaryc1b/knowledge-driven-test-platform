import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ARTIFACT_PATHS } from './m3-r3-final-main/constants.js';
import { createEvidence } from './m3-r3-final-main/evidence.js';
import {
  auditArtifactFiles, loadRepositoryFiles, validateRepository,
} from './m3-r3-final-main/repository.js';

export * from './m3-r3-final-main/constants.js';
export { createEvidence, validateEvidence } from './m3-r3-final-main/evidence.js';
export { loadRepositoryFiles, validateRepository } from './m3-r3-final-main/repository.js';

async function emitArtifact() {
  const evidence = await createEvidence({ validation: {
    focusedStatus: requiredEnv('M3_R3_FINAL_OBSERVER_FOCUSED_STATUS'),
    rootValidationStatus: requiredEnv('M3_R3_FINAL_OBSERVER_ROOT_STATUS'),
    observerValidatorStatus: requiredEnv('M3_R3_FINAL_OBSERVER_VALIDATOR_STATUS'),
  } });
  const files = {
    'evidence/m3-r3-final-main-closure.json': `${JSON.stringify(evidence, null, 2)}\n`,
    ...await loadRepositoryFiles(),
    'logs/m3-r3-final-main-observer-focused-node22.tap':
      await readFile('/tmp/m3-r3-final-main-observer-focused-node22.tap', 'utf8'),
    'logs/m3-r3-final-main-observer-root-validation.log':
      await readFile('/tmp/m3-r3-final-main-observer-root-validation.log', 'utf8'),
    'logs/m3-r3-final-main-observer-validator.log':
      await readFile('/tmp/m3-r3-final-main-observer-validator.log', 'utf8'),
  };
  auditArtifactFiles(files);
  const root = '/tmp/m3-r3-final-main-observer-artifact';
  await rm(root, { recursive: true, force: true });
  for (const path of ARTIFACT_PATHS) {
    const target = resolve(root, path);
    invariant(target.startsWith(`${root}/`), `Unsafe Observer Artifact path: ${path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, files[path], 'utf8');
    const info = await lstat(target);
    invariant(info.isFile() && !info.isSymbolicLink(),
      `Observer Artifact path is not regular: ${path}`);
  }
  process.stdout.write(`${JSON.stringify({
    status: 'success', artifactRoot: root, artifactPathCount: ARTIFACT_PATHS.length,
    evidenceDigest: evidence.evidenceDigest, eventName: evidence.source.eventName,
  })}\n`);
}

function requiredEnv(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0, `${name} is required`);
  return value;
}
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  if (process.argv.includes('--validate-repository')) {
    process.stdout.write(`${JSON.stringify(await validateRepository())}\n`);
  } else if (process.argv.includes('--emit-artifact')) {
    await emitArtifact();
  } else {
    throw new Error('Observer command must be --validate-repository or --emit-artifact');
  }
}
