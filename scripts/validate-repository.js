import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { buildKnowledgeSnapshot, resolveKnowledge } from '../packages/knowledge-core/src/index.js';
import { loadProjectInput } from '../apps/knowledge-cli/src/project-loader.js';

const root = process.cwd();
const required = [
  'README.md',
  'docs/README.md',
  'packages/knowledge-core/src/index.js',
  'apps/knowledge-cli/src/cli.js',
  'examples/approval-platform/project-manifest.json',
];

for (const path of required) {
  await stat(join(root, path));
}

const files = await walk(root);
for (const path of files.filter((path) => path.endsWith('.json'))) {
  JSON.parse(await readFile(path, 'utf8'));
}

for (const path of files.filter((path) => /\.(js|json|md|yaml|yml)$/.test(path))) {
  const content = await readFile(path, 'utf8');
  if (!content.endsWith('\n')) {
    throw new Error(`${relative(root, path)} must end with a newline`);
  }
  if (content.split('\n').some((line) => /[ 	]+$/.test(line))) {
    throw new Error(`${relative(root, path)} contains trailing whitespace`);
  }
}

const input = await loadProjectInput(join(root, 'examples/approval-platform'));
const snapshot = buildKnowledgeSnapshot(resolveKnowledge(input));
if (!snapshot.snapshotId.startsWith('kb-approval-platform-')) {
  throw new Error('Approval example did not produce the expected snapshot namespace');
}

console.log(`Validated ${files.length} files; snapshot ${snapshot.snapshotId}`);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}
