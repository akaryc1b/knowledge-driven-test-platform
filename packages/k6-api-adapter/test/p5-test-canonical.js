import { createHash } from 'node:crypto';

export const clone = (value) => structuredClone(value);
export function canonicalStringify(value) { return JSON.stringify(canonical(value)); }
export function sha256(value) {
  const input = typeof value === 'string' ? value : canonicalStringify(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
export function gitBlobSha(raw) {
  return createHash('sha1').update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex');
}
export function stripDigest(value, field) { const copy = clone(value); delete copy[field]; return copy; }

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => [k, canonical(value[k])]),
  );
  return value;
}

export function invariant(condition, message) { if (!condition) throw new Error(message); }
