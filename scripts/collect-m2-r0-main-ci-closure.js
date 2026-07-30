import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectM2MainBranchCiEvidence } from './collect-m2-main-branch-ci-evidence.js';

export const M2_R0_MAIN_SHA = 'edf09333d9be9ea6839b8cf4d18efed95cfba821';

export async function collectM2R0MainCiClosureEvidence(options = {}) {
  const basePromotion = options.promotion
    ?? JSON.parse(await readFile(options.promotionPath ?? 'releases/m2/r0-production-promotion.json', 'utf8'));
  const promotion = structuredClone(basePromotion);
  promotion.promotionSource = {
    branch: 'main',
    mainSha: M2_R0_MAIN_SHA,
  };

  return collectM2MainBranchCiEvidence({
    ...options,
    promotion,
  });
}

async function collectWithBoundedRetry(options = {}) {
  const attempts = Number(process.env.KDTP_MAIN_CI_COLLECT_ATTEMPTS ?? 12);
  const delayMs = Number(process.env.KDTP_MAIN_CI_COLLECT_DELAY_MS ?? 10000);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30) {
    throw new Error('KDTP_MAIN_CI_COLLECT_ATTEMPTS is invalid');
  }
  if (!Number.isInteger(delayMs) || delayMs < 1000 || delayMs > 60000) {
    throw new Error('KDTP_MAIN_CI_COLLECT_DELAY_MS is invalid');
  }

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await collectM2R0MainCiClosureEvidence(options);
    } catch (error) {
      lastError = error;
      const retryable = /Expected exactly one completed main push validation run, found 0/.test(error?.message ?? '');
      if (!retryable || attempt === attempts) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
  throw lastError;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const evidence = await collectWithBoundedRetry();
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
