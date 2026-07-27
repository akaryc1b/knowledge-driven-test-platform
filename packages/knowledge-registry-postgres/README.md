# @kdtp/knowledge-registry-postgres

PostgreSQL durable adapter for `KnowledgeRegistryPort`.

## Boundary

The package owns PostgreSQL SQL, migrations, transaction handling, row mapping and database error mapping. It does not own authentication, HTTP transport, project authorization or connection configuration.

A caller must inject a pool compatible with the node-postgres `Pool` interface:

```js
import pg from 'pg';
import {
  applyPostgresMigrations,
  PostgresKnowledgeRegistry,
} from '@kdtp/knowledge-registry-postgres';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await applyPostgresMigrations({ pool });
const registry = new PostgresKnowledgeRegistry({ pool });
```

The package deliberately does not construct or close the pool. Pool lifecycle remains the application composition root's responsibility.

## Concurrency guarantees

- `createDraft` serializes version creation per knowledge ID with a transaction-scoped advisory lock;
- `replaceDraft` and `transition` lock the row and persist through revision CAS;
- record and history changes commit atomically;
- reads hydrate records and history in a read-only repeatable-read transaction;
- audit history is append-only at the database layer.

## Migrations

`applyPostgresMigrations` discovers numbered SQL files, applies them in lexical order, stores SHA-256 checksums and refuses modified migrations.
