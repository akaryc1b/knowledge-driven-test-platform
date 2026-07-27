# M1 — Registry and Governance

## 目标

将文件输入升级为经过版本化、持久化、授权、审核和不可变证据治理的公司知识。

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

详细设计见 [`m1-d-durable-governance-evidence.md`](./m1-d-durable-governance-evidence.md)。

- PostgreSQL review decision 与 snapshot envelope；
- append-only 与 immutable 数据库保护；
- Governance Unit of Work；
- Registry 与审核证据同事务提交；
- 并发发布与并发审核测试。

## 下一安全切片

### M1-E — Read-Only Governance Query API

- 只读应用服务边界；
- 项目知识、审核和快照查询 DTO；
- 身份上下文 Port；
- 分页、过滤和错误映射。

仍不开放写入 HTTP API、RBAC 管理后台、AI 自动发布或生产测试执行。
