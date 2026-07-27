#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeSnapshot, resolveKnowledge } from '../../../packages/knowledge-core/src/index.js';
import { loadProjectInput } from './project-loader.js';

export async function run(argv) {
  const [command, projectDirectory, outputPath] = argv;
  if (command !== 'resolve' || !projectDirectory) {
    throw new Error('Usage: knowledge-cli resolve <project-directory> [output-file]');
  }

  const input = await loadProjectInput(resolve(projectDirectory));
  const snapshot = buildKnowledgeSnapshot(resolveKnowledge(input));
  const serialized = `${JSON.stringify(snapshot, null, 2)}
`;

  if (outputPath) {
    await writeFile(resolve(outputPath), serialized, 'utf8');
  } else {
    process.stdout.write(serialized);
  }
  return snapshot;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run(process.argv.slice(2)).catch((error) => {
    const code = error.code ? `[${error.code}] ` : '';
    process.stderr.write(`${code}${error.message}
`);
    process.exitCode = 1;
  });
}
