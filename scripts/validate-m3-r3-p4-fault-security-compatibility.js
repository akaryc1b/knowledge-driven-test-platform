import { pathToFileURL } from 'node:url';
import { createM3R3P4Evidence } from './m3-r3-p4/evidence.js';
import { validateM3R3P4Repository } from './m3-r3-p4/repository-validator.js';

export * from './m3-r3-p4/constants.js';
export * from './m3-r3-p4/evidence.js';
export * from './m3-r3-p4/repository-validator.js';

async function main() {
  if (process.env.M3_R3_P4_EMIT_EVIDENCE === 'true') {
    process.stdout.write(`${JSON.stringify(await createM3R3P4Evidence(), null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(await validateM3R3P4Repository())}\n`);
  }
}

if (process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
