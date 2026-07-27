# M1 — Registry and Governance

## 目标

将 M0 的“文件输入与即时解析”升级为“版本化知识对象经过持久化、授权和审核治理后再进入解析与快照”。

M1 继续保持传输层、管理后台和生产测试执行在范围外。

## M1-A — Knowledge Schema and Registry Boundary

已完成：

- `knowledge-rule/v1` 版本化 JSON Schema；
- 知识逻辑 ID 与严格 SemVer；
- 异步 Registry Port 与内存适配器；
- revision CAS、草稿更新和治理生命周期；
- 可复用 Registry 合同测试。

生命周期：

```text
DRAFT ──submit-review──> REVIEWING ──publish──> PUBLISHED
  ▲                           │                     │
  └────request-changes────────┘                     └──deprecate──> DEPRECATED ──archive──> ARCHIVED
```

## M1-B — Durable Registry Adapter

详细设计见 [`m1-b-durable-registry.md`](./m1-b-durable-registry.md)。

已完成：

- PostgreSQL 18 Schema 与 checksum migration；
- 事务、唯一约束、row lock、advisory lock 和 revision CAS；
- PostgreSQL Registry Adapter；
- Docker Compose 与 CI PostgreSQL 集成测试。

## M1-C — Governance Service Boundary

详细设计见 [`m1-c-governance-service.md`](./m1-c-governance-service.md)。

已完成：

- 项目级授权 Port；
- 作者、审核人和发布人职责分离；
- 绑定 Registry revision 的审核决策；
- risk-level 发布前审批策略；
- 审计查询模型；
- 不可变知识快照 Store Port；
- 内存适配器与可复用合同测试。

## 下一安全切片

### M1-D — Durable Governance Evidence

- PostgreSQL review decision 与 snapshot envelope 持久化；
- append-only 审核证据；
- 治理 Unit of Work；
- Registry 与审核决定的单数据库事务组合；
- durable adapter 合同和并发测试。

仍不开放 HTTP API、身份认证、RBAC 管理后台、AI 自动发布或生产测试执行。
