import { generateKeyPairSync, sign } from 'node:crypto';
import {
  InMemoryAuthenticationEventSink,
  OidcJwksBearerAuthentication,
  StaticSubjectMapper,
} from '../packages/governance-auth-oidc/src/index.js';

const issuer = 'https://issuer.example.test';
const audience = 'knowledge-read-api';
const now = Date.parse('2026-07-27T12:00:00.000Z');
const nowSeconds = Math.floor(now / 1000);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'example-key-1',
  alg: 'RS256',
  use: 'sig',
  key_ops: ['verify'],
};
const token = signJwt(privateKey, {
  alg: 'RS256',
  kid: publicJwk.kid,
}, {
  iss: issuer,
  sub: 'company-user-42',
  aud: audience,
  iat: nowSeconds - 60,
  exp: nowSeconds + 300,
});
const events = new InMemoryAuthenticationEventSink();
const authentication = new OidcJwksBearerAuthentication({
  issuer,
  audience,
  jwksUri: `${issuer}/jwks.json`,
  jwks: {
    fetcher: async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: {
        'content-type': 'application/jwk-set+json',
        'cache-control': 'max-age=300',
      },
    }),
  },
  subjectMapper: new StaticSubjectMapper([{
    issuer,
    subject: 'company-user-42',
    actor: 'quality-reader',
    attributes: { source: 'oidc-example' },
  }]),
  eventSink: events,
  clock: () => now,
});
const identity = await authentication.authenticate({
  scheme: 'Bearer',
  credential: token,
  requestId: 'm1-h-example',
});
process.stdout.write(`${JSON.stringify({
  actor: identity.actor,
  authentication: identity.attributes.authentication,
  eventTypes: events.list().map((event) => event.type),
}, null, 2)}\n`);

function signJwt(key, header, claims) {
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), key).toString('base64url');
  return `${signingInput}.${signature}`;
}
