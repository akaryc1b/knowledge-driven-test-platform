import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createK6ApiSourcePublicationBundle,
} from '../packages/k6-api-adapter/src/source-publication-bundle.js';
import {
  createK6ApiSourcePublicationEvidence,
  publishK6ApiSourceBundle,
} from '../packages/k6-api-adapter/src/source-bundle-publisher.js';
import { loadAcceptedP3Bindings } from '../scripts/validate-m3-r2-source-generation-p4.js';

export async function deterministicK6ApiSourceBundlePublication(options = {}) {
  const bindings = await loadAcceptedP3Bindings();
  const bundle = createK6ApiSourcePublicationBundle(bindings);
  const rootDirectory = options.rootDirectory ?? process.env.M3_R2_P4_STORE_ROOT
    ?? await mkdtemp(join(tmpdir(), 'kdtp-m3-r2-p4-example-'));
  const publishedAt = options.publishedAt ?? process.env.M3_R2_P4_PUBLISHED_AT
    ?? '2026-08-01T09:00:00.000Z';
  const receipt = await publishK6ApiSourceBundle(bundle, {
    rootDirectory,
    publishedAt,
    acceptedP3: bindings.acceptedP3,
  });
  const publicationEvidence = createK6ApiSourcePublicationEvidence({
    bundle,
    receipt,
    acceptedP3: bindings.acceptedP3,
  });
  return { bundle, receipt, publicationEvidence };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await deterministicK6ApiSourceBundlePublication(), null, 2)}\n`);
}
