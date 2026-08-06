import { pathToFileURL } from 'node:url';
import {
  createM3R3G4C1Evidence,
  validateM3R3G4C1Repository,
} from './m3-r3-g4-correction/contract.js';

export * from './m3-r3-g4-correction/contract.js';

async function main() {
  if (process.env.M3_R3_G4_C1_EMIT_EVIDENCE === 'true') {
    process.stdout.write(
      `${JSON.stringify(await createM3R3G4C1Evidence(), null, 2)}\n`);
  } else {
    process.stdout.write(
      `${JSON.stringify(await validateM3R3G4C1Repository())}\n`);
  }
}

if (process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
