# M1 — Registry and Governance

## 目标

将公司知识从文件输入升级为经过版本化、持久化、项目授权、审核、不可变证据和安全只读访问治理的可信资产。

## 已完成切片

### M1-A — Knowledge Schema and Registry Boundary

- 版本化 Schema；
- Registry Port、CAS、生命周期和审计历史。

### M1-B — Durable Registry Adapter

- PostgreSQL Registry；
- migration、锁、事务与真实合同测试。

### M1-C — Governance Service Boundary

- 项目授权；
- 职责分离、revision 绑定审核和发布策略。

### M1-D — Durable Governance Evidence

- PostgreSQL 审核证据与不可变快照；
- 单数据库 Governance Unit of Work。

### M1-E — Read-Only Governance Query API

- 运输无关只读查询；
- DTO、过滤、游标分页和稳定错误 Envelope。

### M1-F — Durable Project Membership and Read Authorization

- 项目目录与成员关系；
- 固定角色；
- PostgreSQL 成员持久化；
- deny-by-default 授权。

### M1-G — Read-Only HTTP Transport and Authentication Boundary

- Node HTTP 只读 Adapter；
- Bearer、请求 ID、限流、白名单和安全响应。

### M1-H — OIDC/JWKS Read Authentication Adapter

详细设计见 [`m1-h-oidc-jwks-auth.md`](./m1-h-oidc-jwks-auth.md)。

- RS256 JWT issuer、audience、时间声明和签名校验；
- HTTPS JWKS、bounded cache、并发刷新和 key rotation；
- subject 到 actor 映射 Port；
- fail-closed 认证和脱敏可观测事件。

## 下一安全切片

### M1-I — Read-Only Service Composition and Operational Controls

- 只读应用组合根；
- 显式配置与启动校验；
- liveness、readiness 和依赖探针；
- graceful shutdown 与结构化运行事件；
- Dockerfile 和本地运行示例。

仍不开放写入 HTTP API、IdP/成员管理后台、AI 自动授权或生产测试执行。
