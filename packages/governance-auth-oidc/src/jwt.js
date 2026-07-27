import { createPublicKey, verify } from 'node:crypto';
import { OidcValidationError, oidcInvariant } from './errors.js';
import { SUPPORTED_JWT_ALGORITHMS } from './constants.js';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_HEADER_BYTES = 4096;
const MAX_CLAIMS_BYTES = 64 * 1024;
const MAX_SIGNATURE_BYTES = 2048;

export function parseCompactJwt(token) {
  oidcInvariant(typeof token === 'string' && token.length >= 16 && token.length <= 4096,
    'JWT_FORMAT_INVALID', 'JWT length is invalid');
  const segments = token.split('.');
  oidcInvariant(segments.length === 3 && segments.every((segment) => BASE64URL_PATTERN.test(segment)),
    'JWT_FORMAT_INVALID', 'JWT must contain three canonical base64url segments');
  const headerBytes = decodeSegment(segments[0], MAX_HEADER_BYTES, 'JWT_HEADER_INVALID');
  const claimBytes = decodeSegment(segments[1], MAX_CLAIMS_BYTES, 'JWT_CLAIMS_INVALID');
  const signature = decodeSegment(segments[2], MAX_SIGNATURE_BYTES, 'JWT_SIGNATURE_INVALID');
  const header = parseJsonObject(headerBytes, 'JWT_HEADER_INVALID');
  const claims = parseJsonObject(claimBytes, 'JWT_CLAIMS_INVALID');
  return {
    header,
    claims,
    signingInput: `${segments[0]}.${segments[1]}`,
    signature,
  };
}

export function validateJwtHeader(header, allowedAlgorithms) {
  oidcInvariant(typeof header.alg === 'string' && allowedAlgorithms.includes(header.alg),
    'JWT_ALGORITHM_REJECTED', 'JWT algorithm is not allowed');
  oidcInvariant(SUPPORTED_JWT_ALGORITHMS.includes(header.alg),
    'JWT_ALGORITHM_UNSUPPORTED', 'JWT algorithm is not supported by this adapter');
  oidcInvariant(typeof header.kid === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(header.kid),
    'JWT_KID_INVALID', 'JWT kid is required');
  oidcInvariant(header.crit === undefined,
    'JWT_CRITICAL_HEADER_UNSUPPORTED', 'JWT critical headers are not supported');
  for (const forbidden of ['jku', 'x5u', 'jwk', 'x5c']) {
    oidcInvariant(header[forbidden] === undefined,
      'JWT_KEY_REFERENCE_REJECTED', 'JWT key references are not accepted from token headers');
  }
  return { alg: header.alg, kid: header.kid };
}

export function validateJwtClaims(claims, options) {
  oidcInvariant(claims.iss === options.issuer,
    'JWT_ISSUER_MISMATCH', 'JWT issuer does not match');
  oidcInvariant(typeof claims.sub === 'string' && claims.sub.length > 0 && claims.sub.length <= 255,
    'JWT_SUBJECT_INVALID', 'JWT subject is invalid');
  const audiences = normalizeAudience(claims.aud);
  oidcInvariant(audiences.some((audience) => options.audiences.includes(audience)),
    'JWT_AUDIENCE_MISMATCH', 'JWT audience does not match');

  const exp = numericDate(claims.exp, 'JWT_EXPIRATION_INVALID');
  const iat = numericDate(claims.iat, 'JWT_ISSUED_AT_INVALID');
  const nbf = claims.nbf === undefined ? null : numericDate(claims.nbf, 'JWT_NOT_BEFORE_INVALID');
  const nowSeconds = Math.floor(options.nowMs / 1000);
  const skew = options.clockSkewSeconds;

  oidcInvariant(exp > nowSeconds - skew,
    'JWT_EXPIRED', 'JWT has expired');
  oidcInvariant(iat <= nowSeconds + skew,
    'JWT_ISSUED_IN_FUTURE', 'JWT issued-at is in the future');
  oidcInvariant(exp > iat,
    'JWT_TIME_RANGE_INVALID', 'JWT expiration must be after issued-at');
  if (nbf !== null) {
    oidcInvariant(nbf <= nowSeconds + skew,
      'JWT_NOT_ACTIVE', 'JWT is not active yet');
    oidcInvariant(exp > nbf,
      'JWT_TIME_RANGE_INVALID', 'JWT expiration must be after not-before');
  }
  if (options.maxTokenAgeSeconds !== null) {
    oidcInvariant(nowSeconds - iat <= options.maxTokenAgeSeconds + skew,
      'JWT_TOO_OLD', 'JWT exceeds the configured maximum age');
  }

  return {
    issuer: claims.iss,
    subject: claims.sub,
    audiences,
    issuedAt: iat,
    expiresAt: exp,
    notBefore: nbf,
  };
}

export function validateSigningJwk(jwk, expected) {
  oidcInvariant(jwk && typeof jwk === 'object' && !Array.isArray(jwk),
    'JWKS_KEY_INVALID', 'JWKS signing key must be an object');
  oidcInvariant(jwk.kid === expected.kid,
    'JWKS_KEY_INVALID', 'JWKS key id does not match');
  oidcInvariant(jwk.kty === 'RSA' && typeof jwk.n === 'string' && typeof jwk.e === 'string',
    'JWKS_KEY_INVALID', 'JWKS key must be an RSA public key');
  oidcInvariant(Buffer.from(jwk.n, 'base64url').length >= 256,
    'JWKS_RSA_KEY_TOO_SMALL', 'JWKS RSA key must be at least 2048 bits');
  oidcInvariant(jwk.alg === undefined || jwk.alg === expected.alg,
    'JWKS_KEY_INVALID', 'JWKS key algorithm does not match');
  oidcInvariant(jwk.use === undefined || jwk.use === 'sig',
    'JWKS_KEY_INVALID', 'JWKS key use must permit signatures');
  oidcInvariant(jwk.key_ops === undefined || (Array.isArray(jwk.key_ops) && jwk.key_ops.includes('verify')),
    'JWKS_KEY_INVALID', 'JWKS key operations must permit verification');
  return jwk;
}

export function verifyJwtSignature(parsed, jwk) {
  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new OidcValidationError('JWKS_KEY_INVALID', 'JWKS key could not be converted');
  }
  return verify(
    'RSA-SHA256',
    Buffer.from(parsed.signingInput, 'ascii'),
    publicKey,
    parsed.signature,
  );
}

function decodeSegment(segment, maxBytes, reasonCode) {
  let bytes;
  try {
    bytes = Buffer.from(segment, 'base64url');
  } catch {
    throw new OidcValidationError(reasonCode, 'JWT segment could not be decoded');
  }
  oidcInvariant(bytes.length > 0 && bytes.length <= maxBytes && bytes.toString('base64url') === segment,
    reasonCode, 'JWT segment is not canonical base64url');
  return bytes;
}

function parseJsonObject(bytes, reasonCode) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new OidcValidationError(reasonCode, 'JWT segment could not be decoded');
  }
  oidcInvariant(value && typeof value === 'object' && !Array.isArray(value),
    reasonCode, 'JWT JSON segment must be an object');
  return value;
}

function normalizeAudience(input) {
  if (typeof input === 'string' && input.length > 0) return [input];
  oidcInvariant(Array.isArray(input) && input.length > 0 && input.length <= 16 &&
    input.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 256) &&
    new Set(input).size === input.length,
  'JWT_AUDIENCE_INVALID', 'JWT audience is invalid');
  return [...input];
}

function numericDate(value, reasonCode) {
  oidcInvariant(Number.isSafeInteger(value) && value >= 0,
    reasonCode, 'JWT numeric date is invalid');
  return value;
}
