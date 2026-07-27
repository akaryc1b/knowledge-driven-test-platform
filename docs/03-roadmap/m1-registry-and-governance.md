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

详细设计见 [`m1-g-read-only-http-auth.md`](./m1-g-read-only-http-auth.md)。

- Node HTTP 只读 Adapter；
- Bearer Credential 与 Authentication Port；
- 请求 ID、限流、内容协商和安全响应头；
- 路由/参数白名单与请求体拒绝；
- HTTP 合同和真实临时 Server 测试。

## 下一安全切片

### M1-H — OIDC/JWKS Read Authentication Adapter

- JWT issuer、audience、algorithm 和时间声明校验；
- JWKS 获取、缓存和 key rotation；
- subject 到 actor 映射；
- fail-closed 认证与可观测事件。

仍不开放写入 HTTP API、成员管理 API、IdP 管理后台、AI 自动授权或生产测试执行。
