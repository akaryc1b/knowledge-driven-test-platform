import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  createK6ApiSourceArtifact,
  createK6ApiSourceValidationEvidence,
  validateK6ApiSourceArtifact,
  validateK6ApiSourceValidationEvidence,
} from '@kdtp/k6-api-adapter';
import { deterministicK6ApiSourceRendering } from './k6-api-source-renderer.js';
import { validateM3R2SourceGenerationP2 } from '../scripts/validate-m3-r2-source-generation-p2.js';
import {
  ACCEPTED_P2,
  ACCEPTED_P2_BRANCH,
  ACCEPTED_P2_GENERATED_AT,
} from '../scripts/m3-r2-p3-baseline.js';

export async function deterministicK6ApiSourceArtifactEvidence() {
  const sourceResult = deterministicK6ApiSourceRendering();
  const p2Evidence = await validateM3R2SourceGenerationP2({
    generatedAt: ACCEPTED_P2_GENERATED_AT,
    commitSha: ACCEPTED_P2.headSha,
    branch: ACCEPTED_P2_BRANCH,
  });
  if (p2Evidence.evidenceDigest !== ACCEPTED_P2.evidenceDigest) {
    throw new Error('Accepted M3-R2 P2 Evidence digest changed');
  }
  const sourceArtifact = createK6ApiSourceArtifact({ sourceResult, p2Evidence });
  const validationEvidence = createK6ApiSourceValidationEvidence({
    sourceArtifact,
    sourceResult,
    p2Evidence,
  });
  validateK6ApiSourceArtifact(sourceArtifact, { sourceResult, p2Evidence });
  validateK6ApiSourceValidationEvidence(validationEvidence, {
    sourceArtifact,
    sourceResult,
    p2Evidence,
  });
  return { sourceResult, p2Evidence, sourceArtifact, validationEvidence };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await deterministicK6ApiSourceArtifactEvidence(), null, 2)}
`);
}
