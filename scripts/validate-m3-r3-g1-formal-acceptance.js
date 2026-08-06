import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { G1_VALIDATOR_PATH } from './m3-r3-g1/constants.js';
import { createM3R3G1Evidence } from './m3-r3-g1/evidence.js';
import { validateM3R3G1Repository } from './m3-r3-g1/repository-validator.js';

export * from './m3-r3-g1/constants.js';
export * from './m3-r3-g1/evidence.js';
export * from './m3-r3-g1/repository-validator.js';

export function validateG1RootValidatorPackage(source) {
  const pkg = JSON.parse(source);
  if (pkg.scripts?.['validate:m3-r3-g1-formal-acceptance']
      !== `node ${G1_VALIDATOR_PATH}`) {
    throw new Error('M3-R3-G1 explicit Validator script is missing');
  }
  const ordered = [
    'validate-m3-r3-p4-fault-security-compatibility.js',
    'validate-m3-r3-g1-formal-acceptance.js',
    'validate-m2-final-release-closure.js',
  ];
  let previous = -1;
  for (const name of ordered) {
    const index = pkg.scripts?.validate?.indexOf(name) ?? -1;
    if (index <= previous) {
      throw new Error(`M3-R3-G1 root Validator missing or reordered: ${name}`);
    }
    previous = index;
  }
  return true;
}

async function main() {
  validateG1RootValidatorPackage(await readFile('package.json', 'utf8'));
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
