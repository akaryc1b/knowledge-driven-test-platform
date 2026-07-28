const TEST_PLAN_ROUTE_PREFIX = /^\/v1\/projects\/[^/]+\/test-plans(?:\/|$)/;

export function createCompositeReadOnlyNodeHttpHandler({ knowledgeHandler, testPlanHandler }) {
  if (typeof knowledgeHandler !== 'function') throw new TypeError('knowledgeHandler must be a function');
  if (typeof testPlanHandler !== 'function') throw new TypeError('testPlanHandler must be a function');
  return function compositeReadOnlyNodeHttpHandler(request, response) {
    const pathname = parsePathname(request?.url);
    return TEST_PLAN_ROUTE_PREFIX.test(pathname)
      ? testPlanHandler(request, response)
      : knowledgeHandler(request, response);
  };
}

export function isReadOnlyTestPlanPath(inputUrl) {
  return TEST_PLAN_ROUTE_PREFIX.test(parsePathname(inputUrl));
}

function parsePathname(input) {
  try { return new URL(input ?? '/', 'http://service.local').pathname; } catch { return ''; }
}
