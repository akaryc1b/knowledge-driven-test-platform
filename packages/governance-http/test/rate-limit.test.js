import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryFixedWindowRateLimiter } from '../src/index.js';

test('fixed-window limiter rejects excess requests and resets at the next window', async () => {
  const limiter = new InMemoryFixedWindowRateLimiter({ limit: 2, windowMs: 1000, clock: () => 100 });
  assert.deepEqual(await limiter.consume({ key: 'reader', now: 100 }), {
    allowed: true, limit: 2, remaining: 1, resetAt: 1000,
  });
  assert.equal((await limiter.consume({ key: 'reader', now: 200 })).allowed, true);
  const limited = await limiter.consume({ key: 'reader', now: 300 });
  assert.deepEqual(limited, { allowed: false, limit: 2, remaining: 0, resetAt: 1000 });
  assert.deepEqual(await limiter.consume({ key: 'reader', now: 1001 }), {
    allowed: true, limit: 2, remaining: 1, resetAt: 2000,
  });
});

test('rate limiter keeps independent keys', async () => {
  const limiter = new InMemoryFixedWindowRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal((await limiter.consume({ key: 'a', now: 10 })).allowed, true);
  assert.equal((await limiter.consume({ key: 'a', now: 20 })).allowed, false);
  assert.equal((await limiter.consume({ key: 'b', now: 20 })).allowed, true);
});
