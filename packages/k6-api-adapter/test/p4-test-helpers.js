import { readFile } from 'node:fs/promises';

const acceptedArtifactBundlePath = new URL(
  '../../../evidence/m3-r2/m3-r2-source-generation-p3-accepted-artifact-bundle.json',
  import.meta.url,
);
const acceptedEvidencePath = new URL(
  '../../../evidence/m3-r2/m3-r2-source-generation-p3-accepted-evidence.json',
  import.meta.url,
);

export async function p4AcceptedBindings() {
  const artifactBundle = JSON.parse(await readFile(acceptedArtifactBundlePath, 'utf8'));
  const p3Evidence = JSON.parse(await readFile(acceptedEvidencePath, 'utf8'));
  return {
    sourceArtifact: artifactBundle.sourceArtifact,
    validationEvidence: artifactBundle.validationEvidence,
    p3Evidence,
  };
}

export function clone(value) { return structuredClone(value); }
