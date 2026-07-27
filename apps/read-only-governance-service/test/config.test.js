import test from 'node:test';
import assert from 'node:assert/strict';
import { loadServiceConfig, publicServiceConfig } from '../src/config.js';

const BASE = {
  KDTP_DATABASE_URL: 'postgresql://user:password@db.example/kdtp',
  KDTP_OIDC_ISSUER: 'https://id.example.com/tenant',
  KDTP_OIDC_JWKS_URI: 'https://id.example.com/tenant/jwks',
  KDTP_OIDC_AUDIENCE: 'kdtp-api,kdtp-read',
  KDTP_OIDC_SUBJECT_MAPPINGS_JSON: JSON.stringify([
    { subject: 'subject-1', actor: 'reader-1', attributes: { source: 'oidc' } },
  ]),
};

test('loads bounded explicit configuration and freezes it', () => {
  const config = loadServiceConfig({ ...BASE, KDTP_HTTP_PORT: '9090' });
  assert.equal(config.http.port, 9090);
  assert.deepEqual(config.oidc.audiences, ['kdtp-api', 'kdtp-read']);
  assert.equal(config.oidc.subjectMappings[0].issuer, BASE.KDTP_OIDC_ISSUER);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.oidc), true);
});

test('requires database, issuer, jwks and subject mapping inputs', () => {
  for (const field of ['KDTP_DATABASE_URL', 'KDTP_OIDC_ISSUER', 'KDTP_OIDC_JWKS_URI', 'KDTP_OIDC_SUBJECT_MAPPINGS_JSON']) {
    const env = { ...BASE };
    delete env[field];
    assert.throws(() => loadServiceConfig(env), (error) => error.code === 'MISSING_SERVICE_CONFIG');
  }
});

test('rejects insecure issuer, invalid port and duplicate subject mapping', () => {
  assert.throws(() => loadServiceConfig({ ...BASE, KDTP_OIDC_ISSUER: 'http://id.example.com' }),
    (error) => error.code === 'INVALID_SERVICE_CONFIG');
  assert.throws(() => loadServiceConfig({ ...BASE, KDTP_HTTP_PORT: '70000' }),
    (error) => error.code === 'INVALID_SERVICE_CONFIG');
  assert.throws(() => loadServiceConfig({
    ...BASE,
    KDTP_OIDC_SUBJECT_MAPPINGS_JSON: JSON.stringify([
      { subject: 'one', actor: 'actor-one' },
      { subject: 'one', actor: 'actor-two' },
    ]),
  }), (error) => error.code === 'INVALID_SERVICE_CONFIG');
});

test('public configuration omits database URL and subject mappings', () => {
  const visible = publicServiceConfig(loadServiceConfig(BASE));
  assert.equal(JSON.stringify(visible).includes('password'), false);
  assert.equal(JSON.stringify(visible).includes('subject-1'), false);
  assert.equal(visible.oidc.issuer, BASE.KDTP_OIDC_ISSUER);
});
