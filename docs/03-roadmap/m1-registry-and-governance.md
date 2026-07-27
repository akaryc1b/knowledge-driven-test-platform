# M1 — Registry and Governance

## 目标

将公司知识从文件输入升级为经过版本化、持久化、项目授权、审核、不可变证据、安全认证和可运维只读服务治理的可信资产。

## 已完成切片

### M1-A — Knowledge Schema and Registry Boundary

- 版本化 Schema、Registry Port、CAS、生命周期和审计。

### M1-B — Durable Registry Adapter

- PostgreSQL Registry、migration、锁和事务。

### M1-C — Governance Service Boundary

- 项目授权、职责分离、revision 绑定审核和发布策略。

### M1-D — Durable Governance Evidence

- PostgreSQL 审核证据、不可变快照和 Unit of Work。

### M1-E — Read-Only Governance Query API

- 运输无关查询、DTO、过滤、游标和错误 Envelope。

### M1-F — Durable Project Membership and Read Authorization

- 项目目录、成员、角色、PostgreSQL 持久化和默认拒绝授权。

### M1-G — Read-Only HTTP Transport and Authentication Boundary

- Node HTTP、Bearer 入口、请求安全、限流和安全响应头。

### M1-H — OIDC/JWKS Read Authentication Adapter

- RS256、issuer/audience、JWKS cache/rotation、subject mapping 和认证事件。

### M1-I — Read-Only Service Composition and Operational Controls

详细设计见 [`m1-i-read-only-service-composition.md`](./m1-i-read-only-service-composition.md)。

- 显式应用组合根；
- 三组 migration 与 JWKS 预热；
- `/live` 和 `/ready`；
- 运行事件、连接跟踪和优雅关闭；
- 非 Root Dockerfile。

## 下一安全切片

### M1-J — Read-Only Deployment Manifest and Fault Acceptance

- Kubernetes manifests；
- Security Context、资源和滚动升级基线；
- PostgreSQL/JWKS 故障恢复；
- SIGTERM 和连接排空验收。

仍不开放写入 HTTP API、管理后台、自动生产发布或生产测试执行。
