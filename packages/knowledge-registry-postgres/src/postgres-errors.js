import { RegistryError } from '@kdtp/knowledge-registry';

/** @param {unknown} error @param {string} operation */
export function mapPostgresError(error, operation) {
  if (error instanceof RegistryError) return error;

  const postgresCode = typeof error === 'object' && error !== null ? error.code : undefined;
  const constraint = typeof error === 'object' && error !== null ? error.constraint : undefined;

  if (postgresCode === '23505' && (
    constraint === 'knowledge_records_pkey' ||
    constraint === 'knowledge_records_identity_unique'
  )) {
    return withCause(new RegistryError(
      'KNOWLEDGE_VERSION_EXISTS',
      'Knowledge id and version already exist',
      { operation, postgresCode, constraint },
    ), error);
  }

  if (['23502', '23503', '23514', '22P02', '22003'].includes(postgresCode)) {
    return withCause(new RegistryError(
      'REGISTRY_STORAGE_CONSTRAINT',
      'PostgreSQL rejected registry data because a storage constraint was violated',
      { operation, postgresCode, constraint },
    ), error);
  }

  return withCause(new RegistryError(
    'REGISTRY_STORAGE_ERROR',
    'PostgreSQL registry operation failed',
    { operation, postgresCode, constraint },
  ), error);
}

function withCause(mapped, cause) {
  mapped.cause = cause;
  return mapped;
}
