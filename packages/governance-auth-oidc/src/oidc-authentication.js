import { HttpBoundaryError, AuthenticationPort, httpInvariant } from '@kdtp/governance-http';
import {
  DEFAULT_ALLOWED_ALGORITHMS,
  DEFAULT_CLOCK_SKEW_SECONDS,
  SUPPORTED_JWT_ALGORITHMS,
} from './constants.js';
import { OidcValidationError, unauthenticated } from './errors.js';
import {
  assertAuthenticationEventSinkPort,
  assertJwksProviderPort,
  assertSubjectMapperPort,
  AuthenticationEventSinkPort,
} from './ports.js';
import { RemoteJwksProvider } from './remote-jwks-provider.js';
import {
  parseCompactJwt,
  validateJwtClaims,
  validateJwtHeader,
  validateSigningJwk,
  verifyJwtSignature,
} from './jwt.js';
import { createAuthenticationEvent, safeRecordAuthenticationEvent } from './telemetry.js';

export class OidcJwksBearerAuthentication extends AuthenticationPort {
  constructor(options) {
    super();
    this.issuer = validateIssuer(options?.issuer);
    this.audiences = normalizeAudiences(options?.audience ?? options?.audiences);
    this.allowedAlgorithms = normalizeAlgorithms(options?.allowedAlgorithms ?? DEFAULT_ALLOWED_ALGORITHMS);
    this.clockSkewSeconds = boundedInteger(
      options?.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS,
      'clockSkewSeconds',
      0,
      300,
    );
    this.maxTokenAgeSeconds = options?.maxTokenAgeSeconds === undefined || options.maxTokenAgeSeconds === null
      ? null
      : boundedInteger(options.maxTokenAgeSeconds, 'maxTokenAgeSeconds', 1, 24 * 60 * 60);
    this.clock = options?.clock ?? (() => Date.now());
    httpInvariant(typeof this.clock === 'function',
      'INVALID_OIDC_CONFIG', 'OIDC clock must be a function', 500);
    this.eventSink = assertAuthenticationEventSinkPort(
      options?.eventSink ?? new AuthenticationEventSinkPort(),
    );
    this.subjectMapper = assertSubjectMapperPort(options?.subjectMapper);
    this.jwksProvider = options?.jwksProvider
      ? assertJwksProviderPort(options.jwksProvider)
      : new RemoteJwksProvider({
        ...options?.jwks,
        issuer: this.issuer,
        jwksUri: options?.jwksUri,
        eventSink: this.eventSink,
        clock: this.clock,
      });
  }

  async authenticate(request) {
    let header = null;
    let claims = null;
    try {
      if (request?.scheme !== 'Bearer' || typeof request?.credential !== 'string') {
        throw unauthenticated('BEARER_REQUIRED');
      }
      const parsed = parseCompactJwt(request.credential);
      header = validateJwtHeader(parsed.header, this.allowedAlgorithms);
      claims = validateJwtClaims(parsed.claims, {
        issuer: this.issuer,
        audiences: this.audiences,
        nowMs: this.clock(),
        clockSkewSeconds: this.clockSkewSeconds,
        maxTokenAgeSeconds: this.maxTokenAgeSeconds,
      });
      const jwk = await this.jwksProvider.getSigningKey({
        issuer: this.issuer,
        kid: header.kid,
        alg: header.alg,
        requestId: request?.requestId,
      });
      validateSigningJwk(jwk, header);
      if (!verifyJwtSignature(parsed, jwk)) {
        throw new OidcValidationError('JWT_SIGNATURE_INVALID', 'JWT signature is invalid');
      }
      const mapped = await this.subjectMapper.map({
        issuer: claims.issuer,
        subject: claims.subject,
        claims: structuredClone(parsed.claims),
      });
      validateMappedIdentity(mapped);
      await safeRecordAuthenticationEvent(this.eventSink, createAuthenticationEvent({
        type: 'AUTHENTICATION_SUCCEEDED',
        at: new Date(this.clock()).toISOString(),
        requestId: request?.requestId,
        issuer: this.issuer,
        kid: header.kid,
        subject: claims.subject,
        reasonCode: 'AUTHENTICATED',
      }));
      return {
        actor: mapped.actor,
        attributes: {
          ...structuredClone(mapped.attributes ?? {}),
          authentication: {
            method: 'oidc-jwt',
            issuer: claims.issuer,
            subject: claims.subject,
            audiences: [...claims.audiences],
            issuedAt: new Date(claims.issuedAt * 1000).toISOString(),
            expiresAt: new Date(claims.expiresAt * 1000).toISOString(),
            keyId: header.kid,
          },
        },
      };
    } catch (error) {
      const reasonCode = failureReason(error);
      await safeRecordAuthenticationEvent(this.eventSink, createAuthenticationEvent({
        type: 'AUTHENTICATION_FAILED',
        at: new Date(this.clock()).toISOString(),
        requestId: request?.requestId,
        issuer: this.issuer,
        kid: header?.kid,
        subject: claims?.subject,
        reasonCode,
      }));
      if (error instanceof HttpBoundaryError) throw error;
      if (error instanceof OidcValidationError) throw unauthenticated(error.reasonCode);
      throw new HttpBoundaryError(
        'AUTHENTICATION_INTERNAL_ERROR',
        'OIDC authentication failed internally',
        500,
        { reasonCode },
      );
    }
  }
}

function validateIssuer(input) {
  httpInvariant(typeof input === 'string' && input.length > 0 && input.length <= 2048,
    'INVALID_OIDC_CONFIG', 'OIDC issuer is required', 500);
  let url;
  try { url = new URL(input); } catch { url = null; }
  httpInvariant(url && url.protocol === 'https:' && url.username === '' && url.password === '' &&
    url.search === '' && url.hash === '',
  'INVALID_OIDC_CONFIG', 'OIDC issuer must be an HTTPS URL', 500);
  return input;
}

function normalizeAudiences(input) {
  const values = typeof input === 'string' ? [input] : input;
  httpInvariant(Array.isArray(values) && values.length > 0 && values.length <= 16 &&
    values.every((value) => typeof value === 'string' && value.length > 0 && value.length <= 256) &&
    new Set(values).size === values.length,
  'INVALID_OIDC_CONFIG', 'OIDC audiences must be unique non-empty strings', 500);
  return [...values];
}

function normalizeAlgorithms(input) {
  httpInvariant(Array.isArray(input) && input.length > 0 &&
    input.every((algorithm) => SUPPORTED_JWT_ALGORITHMS.includes(algorithm)) &&
    new Set(input).size === input.length,
  'INVALID_OIDC_CONFIG', 'OIDC allowed algorithms are invalid', 500);
  return [...input];
}

function boundedInteger(value, field, minimum, maximum) {
  httpInvariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    'INVALID_OIDC_CONFIG', `${field} must be between ${minimum} and ${maximum}`, 500);
  return value;
}

function validateMappedIdentity(identity) {
  httpInvariant(identity && typeof identity === 'object' && !Array.isArray(identity),
    'INVALID_SUBJECT_MAPPING_RESULT', 'Subject mapper returned an invalid identity', 500);
  httpInvariant(typeof identity.actor === 'string' && identity.actor.trim().length > 0,
    'INVALID_SUBJECT_MAPPING_RESULT', 'Subject mapper actor is invalid', 500);
  httpInvariant(identity.attributes === undefined ||
    (identity.attributes && typeof identity.attributes === 'object' && !Array.isArray(identity.attributes)),
  'INVALID_SUBJECT_MAPPING_RESULT', 'Subject mapper attributes are invalid', 500);
}

function failureReason(error) {
  if (error instanceof OidcValidationError) return error.reasonCode;
  if (error instanceof HttpBoundaryError) return error.details?.reasonCode ?? error.code;
  return 'OIDC_INTERNAL_ERROR';
}
