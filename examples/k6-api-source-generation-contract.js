import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  createK6ApiSourceGenerationRequest,
  createK6ApiSourceGeneratorDescriptor,
} from '../packages/k6-api-adapter/src/index.js';
import { compilation } from './k6-api-spec-compiler.js';

export const SOURCE_CONTRACT_REQUESTED_AT = '2026-07-31T05:00:00.000Z';
export const SOURCE_CONTRACT_REQUESTED_BY = 'm3-r2-p1-contract-example';

export async function sourceGenerationContractFixture(overrides = {}) {
  const compiled = overrides.compiled ?? await compilation();
  const descriptor = overrides.descriptor ?? createK6ApiSourceGeneratorDescriptor();
  const request = createK6ApiSourceGenerationRequest({
    descriptor,
    spec: compiled.spec,
    bundle: compiled.bundle,
    compilationEvidence: compiled.evidence,
    requestedAt: overrides.requestedAt ?? SOURCE_CONTRACT_REQUESTED_AT,
    requestedBy: overrides.requestedBy ?? SOURCE_CONTRACT_REQUESTED_BY,
  });
  return {
    compiled,
    descriptor,
    request,
  };
}

export async function sourceGenerationContractExample(overrides = {}) {
  const { descriptor, request } = await sourceGenerationContractFixture(overrides);
  return { descriptor, request };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await sourceGenerationContractExample(), null, 2)}\n`);
}
