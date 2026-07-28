import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const COMMANDS = new Set(['generate', 'validate', 'show', 'coverage']);

export async function run(argv, context = {}) {
  const [command, inputPath] = argv;
  if (!COMMANDS.has(command) || !inputPath) {
    throw new Error('Usage: kdtp-plan <generate|validate|show|coverage> <json-command-file>');
  }
  const orchestration = context.orchestration;
  if (!orchestration) throw new Error('A DurablePlanningOrchestrationService is required');
  const readJson = context.readJson ?? defaultReadJson;
  const write = context.write ?? ((value) => process.stdout.write(`${value}\n`));
  const input = await readJson(inputPath);
  let output;
  if (command === 'generate') output = await orchestration.generate(input);
  if (command === 'validate') output = orchestration.validate(input);
  if (command === 'show') output = await orchestration.read(input);
  if (command === 'coverage') output = await orchestration.coverage(input);
  const serialized = JSON.stringify(output, null, 2);
  write(serialized);
  return output;
}

async function defaultReadJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}
