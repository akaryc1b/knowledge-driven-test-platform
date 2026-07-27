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
│   ├── project-membership-postgres/
│   └── governance-http/
├── schemas/
├── deploy/postgres/
├── examples/
├── docs/
├── scripts/
└── .github/workflows/
```

## M1-G 依赖方向

```text
governance-http
  → governance-query
  → knowledge-governance
  → knowledge-registry

project-membership authorization
  → governance-query / governance service
```

`governance-http` 只负责网络适配、认证入口、限流、路由和安全响应。它不读取数据库，不复制查询规则，也不判断项目角色。

## M1-G 新增结构

```text
packages/governance-http/
├── src/authentication-port.js
├── src/authenticated-identity-context.js
├── src/router.js
├── src/transport.js
├── src/node-http.js
├── src/rate-limit-port.js
└── test/

examples/read-only-http-transport.js
```

Node Server Factory 只创建 handler 或 server，不自行绑定固定地址。应用组合根负责监听地址、TLS 终止、真实认证 Adapter、日志和关闭流程。

## 后续演进

```text
packages/oidc-authentication/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/knowledge-api/
apps/quality-console/
```
