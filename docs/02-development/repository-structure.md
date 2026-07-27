# Monorepo 结构

```text
knowledge-driven-test-platform/
├── apps/
│   └── knowledge-cli/
├── packages/
│   ├── knowledge-core/
│   ├── knowledge-registry/
│   ├── knowledge-registry-postgres/
│   ├── knowledge-governance/
│   ├── knowledge-governance-postgres/
│   └── governance-query/
├── schemas/
│   ├── knowledge/
│   ├── registry/
│   ├── governance/
│   └── query/
├── deploy/postgres/
├── examples/
├── docs/
├── scripts/
└── .github/workflows/
```

## 依赖方向

```text
governance-query
  → knowledge-governance
  → knowledge-registry
  → knowledge-core

knowledge-governance-postgres
  → knowledge-governance
  → knowledge-registry-postgres
```

查询包只消费 Port，不依赖 PostgreSQL、HTTP 框架或应用层。请求身份通过 Port 注入，Handler 只返回运输无关的 `{status, body}`。

## M1-E 新增结构

```text
packages/governance-query/
├── src/query-service.js
├── src/handlers.js
├── src/identity-port.js
├── src/cursor.js
├── src/dto.js
└── test/

schemas/query/
examples/read-only-query-api.js
```

## 后续演进

```text
packages/project-membership/
packages/project-membership-postgres/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/knowledge-api/
apps/quality-console/
```
