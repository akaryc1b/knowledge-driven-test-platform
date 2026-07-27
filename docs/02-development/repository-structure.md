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
│   └── knowledge-governance-postgres/
├── schemas/
├── deploy/postgres/
├── examples/
├── docs/
├── scripts/
└── .github/workflows/
```

## 依赖方向

```text
knowledge-governance-postgres
  → knowledge-governance
  → knowledge-registry
  → knowledge-core

knowledge-governance-postgres
  → knowledge-registry-postgres
  → knowledge-registry
```

应用组合根负责创建 PostgreSQL Pool，并将同一 Pool 注入 Registry、治理证据 Store 与 Governance Unit of Work。

## M1-D 新增结构

```text
packages/knowledge-governance-postgres/
├── migrations/0001_create_governance_evidence.sql
├── src/review-decision-store.js
├── src/snapshot-store.js
├── src/unit-of-work.js
└── test/postgres-integration.test.js

examples/postgres-governance.js
```

PostgreSQL 适配器不读取隐式环境变量，不创建或关闭 Pool。事务绑定适配器只使用调用方提供的 client，不自行开启嵌套事务。

## 后续演进

```text
packages/governance-query/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/knowledge-api/
apps/quality-console/
```
