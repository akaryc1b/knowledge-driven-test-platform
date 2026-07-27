import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpBoundaryError } from '@kdtp/governance-http';
import {
  OidcJwksBearerAuthentication,
  StaticSubjectMapper,
  JwksProviderPort,
} from '../src/index.js';
import { AUDIENCE, ISSUER } from './test-helpers.js';

class Provider extends JwksProviderPort { async getSigningKey() { return {}; } }

test('OIDC authentication rejects non-HTTPS issuers and unsupported algorithms', () => {
  const subjectMapper = new StaticSubjectMapper();
  assert.throws(
    () => new OidcJwksBearerAuthentication({
      issuer: 'http://issuer.example.test',
      audience: AUDIENCE,
      jwksProvider: new Provider(),
      subjectMapper,
    }),
    invalidConfig,
  );
  assert.throws(
    () => new OidcJwksBearerAuthentication({
      issuer: ISSUER,
      audience: AUDIENCE,
      allowedAlgorithms: ['HS256'],
      jwksProvider: new Provider(),
      subjectMapper,
    }),
    invalidConfig,
  );
});

test('OIDC authentication requires explicit audiences and subject mapper', () => {
  assert.throws(
    () => new OidcJwksBearerAuthentication({
      issuer: ISSUER,
      audience: [],
      jwksProvider: new Provider(),
      subjectMapper: new StaticSubjectMapper(),
    }),
    invalidConfig,
  );
  assert.throws(
    () => new OidcJwksBearerAuthentication({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: new Provider(),
    }),
    (error) => error instanceof HttpBoundaryError && error.code === 'INVALID_SUBJECT_MAPPER',
  );
});

function invalidConfig(error) {
  return error instanceof HttpBoundaryError && error.code === 'INVALID_OIDC_CONFIG';
}
