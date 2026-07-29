export function resolveEvidenceBranch(options = {}) {
  if (options.branch !== undefined && options.branch !== null) {
    return requireNonEmptyString(options.branch, options.label ?? 'Release evidence branch');
  }
  for (const value of [
    options.headRef ?? process.env.GITHUB_HEAD_REF,
    options.refName ?? process.env.GITHUB_REF_NAME,
    options.fallback,
  ]) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  throw new Error(`${options.label ?? 'Release evidence branch'} is invalid`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is invalid`);
  }
  return value.trim();
}
