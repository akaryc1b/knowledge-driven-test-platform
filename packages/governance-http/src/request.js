import { createHash, randomUUID } from 'node:crypto';
import { HttpBoundaryError, httpInvariant } from './errors.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizeHttpHeaders(input = {}) {
  httpInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_HTTP_HEADERS', 'Request headers must be an object', 400);
  const output = {};
  for (const [name, raw] of Object.entries(input)) {
    httpInvariant(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name),
      'INVALID_HTTP_HEADERS', 'Request header name is invalid', 400);
    const key = name.toLowerCase();
    const value = Array.isArray(raw) ? raw.join(',') : raw;
    if (value !== undefined) {
      const normalized = String(value);
      httpInvariant(!/[\r\n]/.test(normalized),
        'INVALID_HTTP_HEADERS', 'Request header value is invalid', 400, { header: key });
      output[key] = normalized;
    }
  }
  return output;
}

export function resolveRequestId(headers, factory = () => `req:${randomUUID()}`) {
  const incoming = headers['x-request-id'];
  if (incoming !== undefined && incoming !== '') {
    httpInvariant(REQUEST_ID_PATTERN.test(incoming),
      'INVALID_REQUEST_ID', 'x-request-id is invalid', 400);
    return incoming;
  }
  const generated = factory();
  httpInvariant(typeof generated === 'string' && REQUEST_ID_PATTERN.test(generated),
    'INVALID_REQUEST_ID_FACTORY', 'Request ID factory returned an invalid value', 500);
  return generated;
}

export function assertJsonAccept(headers) {
  const accept = headers.accept;
  if (accept === undefined || accept.trim() === '') return;
  const accepted = accept.split(',').some((raw) => {
    const [mediaRange, ...parameters] = raw.split(';').map((item) => item.trim());
    let q = 1;
    for (const parameter of parameters) {
      if (!/^q=/i.test(parameter)) continue;
      const quality = /^q=(0(?:\.[0-9]{1,3})?|1(?:\.0{1,3})?)$/i.exec(parameter);
      if (!quality) return false;
      q = Number(quality[1]);
    }
    const media = mediaRange.toLowerCase();
    return q > 0 && (media === '*/*' || media === 'application/*' || media === 'application/json');
  });
  httpInvariant(accepted,
    'NOT_ACCEPTABLE', 'Only application/json responses are available', 406);
}

export function extractBearerCredential(headers) {
  const value = headers.authorization;
  if (typeof value !== 'string') throw unauthenticated();
  const match = /^Bearer[ \t]+([^\s]{8,4096})$/i.exec(value);
  if (!match) throw unauthenticated();
  return { scheme: 'Bearer', credential: match[1] };
}

export function assertReadOnlyBody(body, maxBodyBytes) {
  const bytes = body === undefined || body === null
    ? 0
    : Buffer.isBuffer(body)
      ? body.length
      : Buffer.byteLength(String(body));
  httpInvariant(bytes <= maxBodyBytes,
    'PAYLOAD_TOO_LARGE', 'Request body exceeds the read-only limit', 413, {
      maxBodyBytes,
      actualBodyBytes: bytes,
    });
  httpInvariant(bytes === 0,
    'REQUEST_BODY_NOT_ALLOWED', 'Read-only routes do not accept a request body', 400, {
      actualBodyBytes: bytes,
    });
}

export function rateLimitKey(remoteAddress, credential) {
  const fingerprint = createHash('sha256').update(credential).digest('hex');
  return `${remoteAddress || 'unknown'}:${fingerprint}`;
}

function unauthenticated() {
  return new HttpBoundaryError(
    'UNAUTHENTICATED',
    'Bearer credential is required',
    401,
    {},
    { 'www-authenticate': 'Bearer' },
  );
}
