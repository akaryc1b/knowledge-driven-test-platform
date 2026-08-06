import { pathToFileURL } from 'node:url';
import { createM3R3G1Evidence } from './m3-r3-g1/evidence.js';
import { validateM3R3G1Repository } from './m3-r3-g1/repository-validator.js';

export * from './m3-r3-g1/constants.js';
export * from './m3-r3-g1/evidence.js';
export * from './m3-r3-g1/repository-validator.js';

async function main() {
  if (process.env.M3_R3_G1_EMIT_EVIDENCE === 'true') {
    process.stdout.write(
      `${JSON.stringify(await createM3R3G1Evidence(), null, 2)}\n`);
  } else {
    process.stdout.write(
      `${JSON.stringify(await validateM3R3G1Repository())}\n`);
  }
}

if (process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
