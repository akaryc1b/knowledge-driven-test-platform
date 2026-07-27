# M1 — Registry and Governance

## 目标

将文件输入升级为经过版本化、持久化、授权、审核和不可变证据治理的公司知识，并建立多项目只读消费和成员授权边界。

## 已完成切片

### M1-A — Knowledge Schema and Registry Boundary

- 版本化 Schema、Registry Port、CAS、生命周期和审计历史。

### M1-B — Durable Registry Adapter

- PostgreSQL Registry、migration、锁和真实数据库合同测试。

### M1-C — Governance Service Boundary

- 项目授权、职责分离、revision 绑定审核、发布策略和审计查询。

### M1-D — Durable Governance Evidence

- PostgreSQL 审核证据、不可变快照和单数据库 Governance Unit of Work。

### M1-E — Read-Only Governance Query API

- 运输无关的知识、审核和快照查询；
- 身份 Context Port、项目隔离、DTO、游标和错误 envelope。

### M1-F — Durable Project Membership and Read Authorization

详细设计见 [`m1-f-project-membership.md`](./m1-f-project-membership.md)。

- 项目目录和成员关系 Port；
- 固定项目角色与治理动作映射；
- 状态与时间窗口驱动的默认拒绝授权；
- PostgreSQL 项目、成员和 append-only 审计历史；
- CAS、并发更新与单事务读取授权。

## 下一安全切片

### M1-G — Read-Only HTTP Transport and Authentication Boundary

- 只读 HTTP 适配器；
- credential 提取和认证结果组合；
- 请求 ID、响应头和内容协商；
- 只读速率限制与 HTTP 安全合同。

仍不开放写入 HTTP API、成员管理后台、AI 自动发布或生产测试执行。
