import { RegistryError } from '@kdtp/knowledge-registry';

/** @param {unknown} pool */
export function assertPostgresPool(pool) {
  if (!pool || typeof pool !== 'object' || typeof pool.connect !== 'function') {
    throw new RegistryError(
      'INVALID_POSTGRES_POOL',
      'PostgreSQL adapter requires a pool with an async connect() method',
    );
  }
  return pool;
}

/** @param {unknown} client */
export function assertPostgresClient(client) {
  if (!client || typeof client !== 'object' || typeof client.query !== 'function' ||
      typeof client.release !== 'function') {
    throw new RegistryError(
      'INVALID_POSTGRES_CLIENT',
      'PostgreSQL pool returned an invalid client',
    );
  }
  return client;
}
