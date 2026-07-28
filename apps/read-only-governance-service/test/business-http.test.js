import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompositeReadOnlyNodeHttpHandler,
  isReadOnlyTestPlanPath,
} from '../src/business-http.js';

test('composite business handler dispatches every Test Plan path to Test Plan transport', async () => {
  const calls = [];
  const handler = createCompositeReadOnlyNodeHttpHandler({
    knowledgeHandler(request) { calls.push(['knowledge', request.method, request.url]); },
    testPlanHandler(request) { calls.push(['plan', request.method, request.url]); },
  });
  await handler({ method: 'GET', url: '/v1/projects/approval-platform/test-plans' }, {});
  await handler({ method: 'POST', url: '/v1/projects/approval-platform/test-plans/tp-approval-platform-1234567890ab' }, {});
  assert.deepEqual(calls, [
    ['plan', 'GET', '/v1/projects/approval-platform/test-plans'],
    ['plan', 'POST', '/v1/projects/approval-platform/test-plans/tp-approval-platform-1234567890ab'],
  ]);
});

test('composite business handler leaves Knowledge, unknown and malformed paths with Knowledge handler', async () => {
  const calls = [];
  const handler = createCompositeReadOnlyNodeHttpHandler({
    knowledgeHandler(request) { calls.push(['knowledge', request.url]); },
    testPlanHandler(request) { calls.push(['plan', request.url]); },
  });
  for (const url of [
    '/v1/projects/approval-platform/knowledge',
    '/v1/projects/approval-platform/snapshots',
    '/v1/projects/approval-platform/unknown',
    'http://[malformed',
  ]) await handler({ method: 'GET', url }, {});
  assert.deepEqual(calls.map((item) => item[0]), ['knowledge', 'knowledge', 'knowledge', 'knowledge']);
});

test('Test Plan route classifier is exact and constructors reject missing handlers', () => {
  assert.equal(isReadOnlyTestPlanPath('/v1/projects/approval-platform/test-plans'), true);
  assert.equal(isReadOnlyTestPlanPath('/v1/projects/approval-platform/test-plans/plan/coverage'), true);
  assert.equal(isReadOnlyTestPlanPath('/v1/projects/approval-platform/test-plans-extra'), false);
  assert.equal(isReadOnlyTestPlanPath('/v1/projects/approval-platform/knowledge'), false);
  assert.throws(() => createCompositeReadOnlyNodeHttpHandler({ testPlanHandler() {} }), /knowledgeHandler/);
  assert.throws(() => createCompositeReadOnlyNodeHttpHandler({ knowledgeHandler() {} }), /testPlanHandler/);
});
