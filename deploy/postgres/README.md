# Local PostgreSQL Integration Environment

This configuration is for local integration tests only.

```bash
docker compose -f deploy/postgres/compose.yaml up -d
npm install --no-save --package-lock=false pg@8.22.0
KDTP_POSTGRES_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55432/kdtp_test npm run test:postgres
docker compose -f deploy/postgres/compose.yaml down
```

The credentials are deliberately local-only and must not be reused in shared or production environments.
