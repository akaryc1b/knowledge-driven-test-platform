import { generateKeyPairSync, sign } from 'node:crypto';

export const ISSUER = 'https://issuer.example.test';
export const AUDIENCE = 'knowledge-api';
export const NOW_MS = Date.parse('2026-07-27T12:00:00.000Z');
export const NOW_SECONDS = Math.floor(NOW_MS / 1000);

export function createRsaKey(kid, modulusLength = 2048) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength });
  return {
    kid,
    privateKey,
    publicJwk: {
      ...publicKey.export({ format: 'jwk' }),
      kid,
      alg: 'RS256',
      use: 'sig',
      key_ops: ['verify'],
    },
  };
}

export function signJwt(key, overrides = {}) {
  const header = {
    alg: 'RS256',
    kid: key.kid,
    typ: 'JWT',
    ...(overrides.header ?? {}),
  };
  const claims = {
    iss: ISSUER,
    sub: 'user-123',
    aud: AUDIENCE,
    iat: NOW_SECONDS - 60,
    exp: NOW_SECONDS + 300,
    ...(overrides.claims ?? {}),
  };
  const encodedHeader = encode(header);
  const encodedClaims = encode(claims);
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), key.privateKey)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

export function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      'content-type': options.contentType ?? 'application/jwk-set+json',
      ...(options.cacheControl ? { 'cache-control': options.cacheControl } : {}),
    },
  });
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
