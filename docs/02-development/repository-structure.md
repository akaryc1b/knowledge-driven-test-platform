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
│   ├── governance-http/
│   └── governance-auth-oidc/
├── schemas/
│   └── authentication/
├── deploy/postgres/
├── examples/
├── docs/
├── scripts/
└── .github/workflows/
```

## M1-H 依赖方向

```text
governance-auth-oidc
  → governance-http AuthenticationPort
  → Node.js crypto / fetch

governance-http
  → governance-query
  → project-membership authorization
```

`governance-auth-oidc` 只负责验证外部 JWT、解析受信任 claims、获取签名公钥并把 subject 映射为平台 actor。它不读取 Registry、项目成员或业务数据库。

## M1-H 新增结构

```text
packages/governance-auth-oidc/
├── src/oidc-authentication.js
├── src/remote-jwks-provider.js
├── src/jwt.js
├── src/ports.js
├── src/static-subject-mapper.js
├── src/telemetry.js
└── test/

schemas/authentication/
examples/oidc-jwks-authentication.js
```

OIDC Adapter 使用显式 issuer 和 jwksUri，不隐式执行 Discovery。应用组合根负责真实 subject mapping、事件 Sink、网络策略和配置来源。

## 后续演进

```text
apps/knowledge-read-api/
packages/runtime-observability/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/quality-console/
```
