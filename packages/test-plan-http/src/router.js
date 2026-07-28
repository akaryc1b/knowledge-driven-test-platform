import { HttpBoundaryError, httpInvariant } from '@kdtp/governance-http';
import { TEST_PLAN_QUERY_PARAMETERS } from './constants.js';

const ROUTES = Object.freeze([
  route('getCoverage', /^\/v1\/projects\/([^/]+)\/test-plans\/([^/]+)\/coverage$/, []),
  route('getProvenance', /^\/v1\/projects\/([^/]+)\/test-plans\/([^/]+)\/provenance$/, []),
  route('getTimeline', /^\/v1\/projects\/([^/]+)\/test-plans\/([^/]+)\/timeline$/, []),
  route('getPlan', /^\/v1\/projects\/([^/]+)\/test-plans\/([^/]+)$/, []),
  route('listPlans', /^\/v1\/projects\/([^/]+)\/test-plans$/, TEST_PLAN_QUERY_PARAMETERS),
]);

export function matchReadOnlyTestPlanRoute(method, inputUrl, maxUrlLength = 4096) {
  httpInvariant(typeof inputUrl === 'string' && inputUrl.length > 0 && inputUrl.length <= maxUrlLength,
    'INVALID_HTTP_URL', 'Request URL is invalid', 400);
  let url;
  try {
    url = new URL(inputUrl, 'http://kdtp.local');
  } catch {
    throw new HttpBoundaryError('INVALID_HTTP_URL', 'Request URL is invalid', 400);
  }
  const routeMatch = ROUTES.find((candidate) => candidate.pattern.test(url.pathname));
  if (!routeMatch) {
    throw new HttpBoundaryError('ROUTE_NOT_FOUND', 'Read-only Test Plan route was not found', 404);
  }
  if (method !== 'GET') {
    throw new HttpBoundaryError(
      'METHOD_NOT_ALLOWED',
      'Only GET is allowed for this route',
      405,
      {},
      { allow: 'GET' },
    );
  }
  const match = routeMatch.pattern.exec(url.pathname);
  const segments = match.slice(1).map(decodePathSegment);
  const query = parseQuery(url.searchParams, routeMatch.queryParameters);
  return {
    handler: routeMatch.handler,
    projectId: segments[0],
    params: segments[1] ? { planId: segments[1] } : {},
    query,
  };
}

function route(handler, pattern, queryParameters) {
  return { handler, pattern, queryParameters: new Set(queryParameters) };
}

function decodePathSegment(value) {
  try {
    const decoded = decodeURIComponent(value);
    httpInvariant(decoded.length > 0 && !decoded.includes('/'),
      'INVALID_HTTP_PATH', 'Request path contains an invalid segment', 400);
    return decoded;
  } catch (error) {
    if (error instanceof HttpBoundaryError) throw error;
    throw new HttpBoundaryError('INVALID_HTTP_PATH', 'Request path contains invalid encoding', 400);
  }
}

function parseQuery(searchParams, allowed) {
  const query = {};
  for (const key of new Set(searchParams.keys())) {
    httpInvariant(allowed.has(key),
      'UNKNOWN_QUERY_PARAMETER', `Query parameter ${key} is not allowed`, 400, { parameter: key });
    const values = searchParams.getAll(key);
    httpInvariant(values.length === 1,
      'DUPLICATE_QUERY_PARAMETER', `Query parameter ${key} must appear once`, 400, { parameter: key });
    query[key] = values[0];
  }
  return query;
}
