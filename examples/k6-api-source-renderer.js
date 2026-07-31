import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { renderK6ApiSource } from '../packages/k6-api-adapter/src/index.js';
import { rendererBindings } from './k6-api-source-renderer-fixture.js';

export function deterministicK6ApiSourceRendering() {
  return renderK6ApiSource(rendererBindings({
    requestedAt: '2026-07-31T07:00:00.000Z',
    requestedBy: 'm3-r2-p2-example',
  }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(deterministicK6ApiSourceRendering(), null, 2)}\n`);
}
