import test from 'node:test';
import assert from 'node:assert/strict';
import {
  K6_API_SOURCE_LIMITS,
  expectRejected,
  renderK6ApiSource,
  rendererBindings,
  statusAssertion,
  threshold,
  validRendering,
  validateK6ApiRenderedSource,
} from './source-renderer-test-support.js';

for (const [name, inject] of [
  ['non-whitelisted static import', (source) => `import exec from 'k6/execution';\n${source}`],
  ['side-effect static import', (source) => `import 'k6/experimental/fs';\n${source}`],
  ['dynamic import', (source) => source.replace('export default function',
    "import('k6/execution');\nexport default function")],
  ['eval', (source) => source.replace('export default function',
    "eval('1');\nexport default function")],
  ['Function constructor', (source) => source.replace('export default function',
    "new Function('return 1');\nexport default function")],
  ['Node.js process material', (source) => source.replace('export default function',
    'process.exit(0);\nexport default function')],
]) test(`${name} is rejected`, () => {
  const { input, result } = validRendering(rendererBindings);
  expectRejected(() => validateK6ApiRenderedSource(inject(result.source), input));
});

test('callback or function body in structured input is rejected', () => {
  const input = rendererBindings();
  input.spec.requestGroups[0].operations[0].callback = () => true;
  expectRejected(() => renderK6ApiSource(input));
});

test('arbitrary Source supplied as renderer input is rejected', () => {
  const input = rendererBindings();
  input.source = 'export default function () {}';
  expectRejected(() => renderK6ApiSource(input));
});

test('Secret material is rejected', () => {
  expectRejected(() => rendererBindings({
    transformSpec(spec) {
      spec.requestGroups[0].operations[0].sourceOperationId =
        'Bearer abcdefghijklmnopqrstuvwxyz';
    },
  }));
});

test('credential URI is rejected', () => {
  expectRejected(() => rendererBindings({
    transformSpec(spec) { spec.projectId = 'https://user:password@service.internal/project'; },
  }));
});

test('absolute filesystem path is rejected', () => {
  expectRejected(() => rendererBindings({
    transformSpec(spec) { spec.projectId = '/tmp/kdtp-renderer'; },
  }));
});

test('Runtime parameters are rejected by the closed input contract', () => {
  const input = rendererBindings();
  input.runtimeParameters = { baseUrl: 'service.internal' };
  expectRejected(() => renderK6ApiSource(input));
});

test('oversized rendered Source is rejected without execution', () => {
  const input = rendererBindings();
  const source = `${'x'.repeat(K6_API_SOURCE_LIMITS.maxSerializedSpecBytes + 1)}\n`;
  expectRejected(() => validateK6ApiRenderedSource(source, input), /byte limit|large/i);
});

test('too many operations are rejected by fixed P1 limits', () => {
  expectRejected(() => rendererBindings({
    transformSpec(spec) {
      const operation = spec.requestGroups[0].operations[0];
      spec.requestGroups[0].operations = Array.from(
        { length: K6_API_SOURCE_LIMITS.maxOperations + 1 }, () => operation,
      );
    },
  }), /operation|limit/i);
});

test('too many assertions are rejected by fixed P1 limits', () => {
  expectRejected(() => rendererBindings({
    transformSpec(spec) {
      spec.requestGroups[0].operations[0].assertions = Array.from(
        { length: K6_API_SOURCE_LIMITS.maxAssertionsPerOperation + 1 },
        (_, index) => statusAssertion((index + 10).toString(16), [200]),
      );
    },
  }), /assertion|limit/i);
});

test('too many thresholds are rejected by fixed P1 limits', () => {
  expectRejected(() => rendererBindings({
    transformSpec(spec) {
      spec.requestGroups[0].operations[0].thresholds = Array.from(
        { length: K6_API_SOURCE_LIMITS.maxThresholdsPerOperation + 1 },
        (_, index) => threshold((index + 10).toString(16),
          'CHECK_SUCCESS_RATE', 'GREATER_THAN_OR_EQUAL', 0.9),
      );
    },
  }), /threshold|limit/i);
});

test('generated Source contains no volatile CI or timestamp metadata', () => {
  const { source } = renderK6ApiSource(rendererBindings());
  for (const pattern of [
    /2026-\d{2}-\d{2}T/, /commit[_ -]?sha/i, /refs\/heads/i,
    /run[_ -]?id/i, /github\./i, /agent\/m3-r2/i,
  ]) assert.doesNotMatch(source, pattern);
});

test('generated Source contains no random, environment, Secret or absolute-path material', () => {
  const { source } = renderK6ApiSource(rendererBindings());
  for (const pattern of [
    /Math\.random|crypto\.random|Date\.now|new Date/, /__ENV/, /process\.env/,
    /\bpassword\b|\bsecret\b|\bauthorization\b/i,
    /(?:[A-Za-z]:\\|\/(?:tmp|var|etc|home|Users|opt|root)\/)/,
  ]) assert.doesNotMatch(source, pattern);
});
