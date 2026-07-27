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
│   ├── governance-query/
│   ├── project-membership/
│   └── project-membership-postgres/
├── schemas/
│   ├── knowledge/
│   ├── registry/
│   ├── governance/
│   ├── query/
│   └── access/
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

project-membership
  → knowledge-governance

project-membership-postgres
  → project-membership
  → knowledge-registry-postgres
```

`ProjectMembershipAuthorization` 实现现有 `ProjectAuthorizationPort`，因此治理写服务和只读查询服务无需感知成员数据来自内存还是 PostgreSQL。

## M1-F 新增结构

```text
packages/project-membership/
├── src/lifecycle.js
├── src/authorization.js
├── src/in-memory-directory.js
├── src/in-memory-memberships.js
└── test/

packages/project-membership-postgres/
├── migrations/0001_create_project_access.sql
├── src/project-directory.js
├── src/membership-store.js
├── src/authorization.js
└── test/postgres-integration.test.js

schemas/access/
examples/project-membership-authorization.js
```

PostgreSQL 授权适配器在一个只读 `REPEATABLE READ` 事务中联合读取项目和成员，避免跨查询观察到不一致状态。
