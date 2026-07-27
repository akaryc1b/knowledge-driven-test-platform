import { canonicalize, sha256 } from './canonical-json.js';
import { invariant } from './errors.js';

/**
 * @param {{context: Record<string, unknown>, rules: unknown[], resolution: unknown[]}} resolved
 */
export function buildKnowledgeSnapshot(resolved) {
  invariant(resolved && typeof resolved === 'object',
    'INVALID_RESOLVED_KNOWLEDGE', 'Resolved knowledge is required');

  const payload = canonicalize({
    schemaVersion: 1,
    context: resolved.context,
    rules: [...resolved.rules].sort((a, b) => a.boundaryKey.localeCompare(b.boundaryKey)),
    resolution: [...resolved.resolution].sort((a, b) => a.boundaryKey.localeCompare(b.boundaryKey)),
  });

  const digest = sha256(payload);
  const projectSlug = String(resolved.context.projectId)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    snapshotId: `kb-${projectSlug}-${digest.slice(0, 12)}`,
    digest,
    ...payload,
  };
}
