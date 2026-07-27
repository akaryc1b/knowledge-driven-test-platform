import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpBoundaryError } from '@kdtp/governance-http';
import {
  InMemoryAuthenticationEventSink,
  JwksProviderPort,
  OidcJwksBearerAuthentication,
  StaticSubjectMapper,
} from '../src/index.js';
import { AUDIENCE, createRsaKey, ISSUER, NOW_MS, NOW_SECONDS, signJwt } from './test-helpers.js';

const primary = createRsaKey('key-1');

class StaticJwksProvider extends JwksProviderPort {
  constructor(jwk = primary.publicJwk) { super(); this.jwk = jwk; this.calls = 0; }
  async getSigningKey() { this.calls += 1; return structuredClone(this.jwk); }
}

function createAuthentication(options = {}) {
  return new OidcJwksBearerAuthentication({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksProvider: options.jwksProvider ?? new StaticJwksProvider(),
    subjectMapper: options.subjectMapper ?? new StaticSubjectMapper([{
      issuer: ISSUER,
      subject: 'user-123',
      actor: 'platform-user',
      attributes: { department: 'quality' },
    }]),
    eventSink: options.eventSink,
    clock: options.clock ?? (() => NOW_MS),
    clockSkewSeconds: options.clockSkewSeconds ?? 60,
    maxTokenAgeSeconds: options.maxTokenAgeSeconds,
  });
}

test('valid RS256 JWT maps OIDC subject to a platform actor', async () => {
  const authentication = createAuthentication();
  const identity = await authentication.authenticate({
    scheme: 'Bearer',
    credential: signJwt(primary),
    requestId: 'request-1',
  });
  assert.equal(identity.actor, 'platform-user');
  assert.equal(identity.attributes.department, 'quality');
  assert.equal(identity.attributes.authentication.method, 'oidc-jwt');
  assert.equal(identity.attributes.authentication.subject, 'user-123');
  assert.equal(identity.attributes.authentication.keyId, 'key-1');
});

test('issuer and audience mismatches fail with one generic public error', async () => {
  const authentication = createAuthentication();
  for (const credential of [
    signJwt(primary, { claims: { iss: 'https://other.example.test' } }),
    signJwt(primary, { claims: { aud: 'other-api' } }),
  ]) {
    await assert.rejects(authentication.authenticate({ scheme: 'Bearer', credential }), genericUnauthenticated);
  }
});

test('expired, future nbf and future iat claims are rejected', async () => {
  const authentication = createAuthentication({ clockSkewSeconds: 0 });
  const credentials = [
    signJwt(primary, { claims: { exp: NOW_SECONDS } }),
    signJwt(primary, { claims: { nbf: NOW_SECONDS + 1 } }),
    signJwt(primary, { claims: { iat: NOW_SECONDS + 1, exp: NOW_SECONDS + 100 } }),
  ];
  for (const credential of credentials) {
    await assert.rejects(authentication.authenticate({ scheme: 'Bearer', credential }), genericUnauthenticated);
  }
});

test('maximum token age is enforced independently from expiration', async () => {
  const authentication = createAuthentication({ maxTokenAgeSeconds: 300, clockSkewSeconds: 0 });
  await assert.rejects(authentication.authenticate({
    scheme: 'Bearer',
    credential: signJwt(primary, { claims: { iat: NOW_SECONDS - 301 } }),
  }), genericUnauthenticated);
});

test('algorithm allow-list rejects non-RS256 tokens before JWKS lookup', async () => {
  const provider = new StaticJwksProvider();
  const authentication = createAuthentication({ jwksProvider: provider });
  await assert.rejects(authentication.authenticate({
    scheme: 'Bearer',
    credential: signJwt(primary, { header: { alg: 'HS256' } }),
  }), genericUnauthenticated);
  assert.equal(provider.calls, 0);
});

test('token-supplied key URLs and critical headers are rejected', async () => {
  const authentication = createAuthentication();
  for (const header of [
    { jku: 'https://attacker.example/jwks.json' },
    { crit: ['custom'], custom: true },
  ]) {
    await assert.rejects(authentication.authenticate({
      scheme: 'Bearer',
      credential: signJwt(primary, { header }),
    }), genericUnauthenticated);
  }
});

test('signature tampering is rejected', async () => {
  const authentication = createAuthentication();
  const token = signJwt(primary);
  const parts = token.split('.');
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({
    iss: ISSUER,
    sub: 'user-123',
    aud: AUDIENCE,
    iat: NOW_SECONDS - 60,
    exp: NOW_SECONDS + 300,
    admin: true,
  })).toString('base64url')}.${parts[2]}`;
  await assert.rejects(authentication.authenticate({ scheme: 'Bearer', credential: tampered }), genericUnauthenticated);
});

test('unmapped and disabled subjects are denied', async () => {
  for (const mapper of [
    new StaticSubjectMapper(),
    new StaticSubjectMapper([{ issuer: ISSUER, subject: 'user-123', actor: 'disabled-user', disabled: true }]),
  ]) {
    await assert.rejects(createAuthentication({ subjectMapper: mapper }).authenticate({
      scheme: 'Bearer',
      credential: signJwt(primary),
    }), genericUnauthenticated);
  }
});

test('authentication events contain fingerprints but never credentials or full claims', async () => {
  const sink = new InMemoryAuthenticationEventSink();
  const authentication = createAuthentication({ eventSink: sink });
  const credential = signJwt(primary, { claims: { email: 'private@example.test' } });
  await authentication.authenticate({ scheme: 'Bearer', credential, requestId: 'request-events' });
  await assert.rejects(authentication.authenticate({
    scheme: 'Bearer', credential: `${credential}x`, requestId: 'request-failed',
  }));
  const serialized = JSON.stringify(sink.list());
  assert.equal(serialized.includes(credential), false);
  assert.equal(serialized.includes('private@example.test'), false);
  assert.equal(sink.list()[0].subjectFingerprint.length, 64);
  assert.deepEqual(sink.list().map((event) => event.type), [
    'AUTHENTICATION_SUCCEEDED',
    'AUTHENTICATION_FAILED',
  ]);
});

test('JWKS infrastructure failures remain 5xx while invalid tokens remain 401', async () => {
  class UnavailableProvider extends JwksProviderPort {
    async getSigningKey() {
      throw new HttpBoundaryError('AUTHENTICATION_UNAVAILABLE', 'unavailable', 503, {
        reasonCode: 'JWKS_FETCH_FAILED',
      });
    }
  }
  await assert.rejects(createAuthentication({ jwksProvider: new UnavailableProvider() }).authenticate({
    scheme: 'Bearer',
    credential: signJwt(primary),
  }), (error) => error instanceof HttpBoundaryError && error.status === 503);
});

function genericUnauthenticated(error) {
  return error instanceof HttpBoundaryError &&
    error.code === 'UNAUTHENTICATED' &&
    error.status === 401 &&
    error.message === 'Bearer credential is invalid';
}
