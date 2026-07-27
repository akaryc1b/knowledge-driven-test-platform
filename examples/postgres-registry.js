import {
  applyPostgresMigrations,
  PostgresKnowledgeRegistry,
} from '../packages/knowledge-registry-postgres/src/index.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const { Pool } = await import('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await applyPostgresMigrations({ pool });
  const registry = new PostgresKnowledgeRegistry({ pool });
  const records = await registry.list({});
  console.log(JSON.stringify({ records: records.length }, null, 2));
} finally {
  await pool.end();
}
