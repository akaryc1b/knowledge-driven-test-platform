# M1 — Registry and Governance

## 目标

将文件输入升级为经过版本化、持久化、授权、审核、不可变证据和受控查询治理的公司知识。

## 已完成切片

### M1-A — Knowledge Schema and Registry Boundary

- 版本化 Schema；
- Registry Port 和内存适配器；
- CAS、生命周期和审计历史。

### M1-B — Durable Registry Adapter

- PostgreSQL Registry；
- checksum migration；
- advisory lock、row lock 和 CAS；
- 真实数据库合同测试。

### M1-C — Governance Service Boundary

- 项目授权；
- 职责分离；
- revision 绑定审核；
- 发布策略、审计查询和快照 Store Port。

### M1-D — Durable Governance Evidence

- PostgreSQL review decision 与 snapshot envelope；
- append-only 与 immutable 数据库保护；
- Governance Unit of Work；
- Registry 与审核证据同事务提交；
- 并发发布与并发审核测试。

### M1-E — Read-Only Governance Query API

详细设计见 [`m1-e-read-only-query-api.md`](./m1-e-read-only-query-api.md)。

- 请求身份上下文 Port；
- 项目知识、审核时间线和快照 DTO；
- 只读项目授权；
- 过滤、排序和 opaque cursor；
- 稳定 response/error envelope；
- HTTP-free Handler 合同。

## 下一安全切片

### M1-F — Durable Project Membership and Read Authorization

- 项目目录和成员关系；
- 项目角色到治理动作映射；
- PostgreSQL 成员 Adapter；
- deny-by-default 和停用控制；
- 多项目授权合同。

仍不开放 OAuth/OIDC、写入 HTTP API、管理后台、AI 自动发布或生产测试执行。
