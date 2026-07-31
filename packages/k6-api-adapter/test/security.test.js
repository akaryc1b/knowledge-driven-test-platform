import test from 'node:test';
import assert from 'node:assert/strict';
import { compileK6ApiExecutionSpec } from '../src/index.js';
import { compilerInput } from './test-helpers.js';

test('compiler rejects digest tampering and mutable Artifact references', async () => {
  const input = await compilerInput();
  const digestTamper = structuredClone(input);
  digestTamper.executionRequest.requestDigest = '8'.repeat(64);
  assert.throws(() => compileK6ApiExecutionSpec(digestTamper),
    (error) => error.code === 'EXECUTION_REQUEST_DIGEST_MISMATCH');

  const mutable = structuredClone(input);
  mutable.executionRequest.inputArtifacts[0].uri = 'artifact://latest/payload';
  assert.throws(() => compileK6ApiExecutionSpec(mutable),
    (error) => error.code === 'MUTABLE_ARTIFACT_REFERENCE');
});

test('compiler rejects Secret, placeholder, executable source, network URL and file path material', async () => {
  for (const [compiledBy, code] of [
    ['Bearer abcdefghijklmnopqrstuvwxyz', 'SENSITIVE_EXECUTION_DATA'],
    ['replace-me', 'EXECUTION_PLACEHOLDER_FORBIDDEN'],
    ['export default function run() {}', 'K6_API_EXECUTABLE_SOURCE_FORBIDDEN'],
    ['https://target.internal/v1', 'K6_API_NETWORK_TARGET_FORBIDDEN'],
    ['/tmp/runtime-output', 'K6_API_FILE_PATH_FORBIDDEN'],
  ]) {
    const input = await compilerInput({ compiledBy });
    assert.throws(() => compileK6ApiExecutionSpec(input),
      (error) => error.code === code, `${compiledBy} should fail as ${code}`);
  }
});
