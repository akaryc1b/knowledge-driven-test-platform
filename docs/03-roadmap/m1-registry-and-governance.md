# M1 — Registry and Governance

## 目标

在不引入数据库、认证、管理后台和生产执行的前提下，建立可替换、可审计的知识注册边界。

M1 将 M0 的“文件输入与即时解析”升级为“版本化知识对象经过治理后再进入解析与快照”。

## M1-A — Knowledge Schema and Registry Boundary

### 允许范围

- `knowledge-rule/v1` 版本化 JSON Schema；
- 知识逻辑 ID 与严格 SemVer 规则；
- 异步 Registry Port；
- 内存 Registry 适配器；
- revision CAS；
- 草稿更新；
- 发布生命周期纯领域模型；
- 可复用 Registry 合同测试。

### 明确不做

- PostgreSQL 或其他生产持久化；
- HTTP API；
- 登录、RBAC 和项目成员管理；
- 管理后台；
- AI 自动审核或发布；
- 自动迁移旧知识；
- k6 Worker、队列或生产执行。

### 生命周期

```text
DRAFT ──submit-review──> REVIEWING ──publish──> PUBLISHED
  ▲                           │                     │
  └────request-changes────────┘                     └──deprecate──> DEPRECATED ──archive──> ARCHIVED
```

禁止直接跳过审核发布，禁止将已发布知识恢复为草稿。修改已发布知识必须创建更高版本。

### 版本规则

- `id` 是跨版本稳定的逻辑标识；
- `version` 采用不含预发布和构建元数据的 `MAJOR.MINOR.PATCH`；
- Registry 唯一键为 `id@version`；
- 同一 ID 的新草稿版本必须严格大于已注册最高版本；
- 已发布内容不可替换，只允许状态进入 `DEPRECATED` 和 `ARCHIVED`；
- 所有写操作必须携带 actor、UTC 时间和原因；
- 更新与状态转换必须携带 `expectedRevision`。

### 验收标准

- Schema 文件可被仓库校验脚本发现并验证基本元数据；
- 非法 ID、非法 SemVer、未知 Schema 版本被稳定错误码拒绝；
- 重复 `id@version` 被拒绝；
- 低版本或相同版本的新草稿被拒绝；
- 合法生命周期可以完整运行；
- 非法状态跳转被拒绝；
- revision 冲突被拒绝；
- Registry 返回防御性副本；
- 合同测试可复用于未来数据库适配器；
- M0 Resolver 与 Snapshot 测试继续通过。

## 后续安全切片

### M1-B — Durable Registry Adapter

详细设计见 [`m1-b-durable-registry.md`](./m1-b-durable-registry.md)。

- PostgreSQL Schema 与 checksum migration；
- 事务、唯一约束、row lock、advisory lock 和 revision CAS；
- PostgreSQL Registry Adapter；
- 与内存实现相同的合同测试；
- Docker Compose 与 CI PostgreSQL 集成测试。

仍不开放 HTTP、认证、管理后台和 AI 自动发布。

### M1-C — Governance Service Boundary

- 项目级授权端口；
- 审核决策对象；
- 审计查询；
- 发布前策略检查；
- 快照持久化端口。
