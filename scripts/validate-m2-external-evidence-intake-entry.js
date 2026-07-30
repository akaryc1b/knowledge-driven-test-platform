import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveEvidenceBranch } from './release-evidence-environment.js';
import { validateM2ExternalEvidenceIntake } from './validate-m2-external-evidence-intake.js';

export async function validateM2ExternalEvidenceIntakeEntry(options = {}) {
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    headRef: options.headRef,
    refName: options.refName,
    fallback: 'agent/m2-rc1-r2a-external-evidence-intake',
    label: 'R2-A evidence branch',
  });
  return validateM2ExternalEvidenceIntake({ ...options, branch });
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2ExternalEvidenceIntakeEntry(), null, 2)}\n`);
}
