import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveEvidenceBranch } from './release-evidence-environment.js';
import {
  validateM2ProductionPromotion as validateM2ProductionPromotionRecord,
} from './validate-m2-production-promotion-r1b.js';

export async function validateM2ProductionPromotion(options = {}) {
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    fallback: 'agent/m2-rc1-r1b-immutable-image-binding',
    label: 'M2 production promotion evidence branch',
  });
  return validateM2ProductionPromotionRecord({ ...options, branch });
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2ProductionPromotion(), null, 2)}\n`);
}
