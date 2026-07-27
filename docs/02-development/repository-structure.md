# Monorepo 结构

```text
knowledge-driven-test-platform/
├── apps/
│   ├── knowledge-cli/
│   └── read-only-governance-service/
├── packages/
│   ├── knowledge-core/
│   ├── knowledge-registry/
│   ├── knowledge-registry-postgres/
│   ├── knowledge-governance/
│   ├── knowledge-governance-postgres/
│   ├── governance-query/
│   ├── project-membership/
│   ├── project-membership-postgres/
│   ├── governance-http/
│   └── governance-auth-oidc/
├── schemas/
│   ├── knowledge/
│   ├── registry/
│   ├── governance/
│   ├── query/
│   ├── access/
│   ├── authentication/
│   └── operations/
├── deploy/postgres/
├── examples/
├── docs/
├── scripts/
└── .github/workflows/
```

## M1-I 依赖方向

```text
read-only-governance-service
  → governance-auth-oidc
  → governance-http
  → governance-query
  → knowledge-registry-postgres
  → knowledge-governance-postgres
  → project-membership-postgres
  → pg（运行时 Driver）
```

应用组合根可以读取环境变量、创建 Pool、执行 migrations、监听端口和处理进程信号。任何 package 都不得反向依赖应用层。

## M1-I 新增结构

```text
apps/read-only-governance-service/
├── src/config.js
├── src/composition.js
├── src/readiness.js
├── src/operational-http.js
├── src/runtime-events.js
├── src/service.js
├── src/main.js
├── test/
├── Dockerfile
└── service.env.example

schemas/operations/
examples/read-only-service-operational.js
```

## 运行约束

- `main.js` 动态加载 `pg`；
- Docker 镜像固定安装 `pg@8.22.0`；
- Server Factory 不在 package 中隐藏创建；
- 探针不经过业务认证，但也不访问业务 DTO；
- 运行事件拒绝敏感 Detail Key；
- 应用关闭前先撤销 readiness。

## 后续演进

```text
deploy/read-only-service/kubernetes/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/quality-console/
```
