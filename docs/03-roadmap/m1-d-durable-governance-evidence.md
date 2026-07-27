# M1-D — Durable Governance Evidence

## 目标

将 M1-C 的内存审核决定和快照 Store 升级为 PostgreSQL 持久化实现，并保证审核证据与 Registry 状态转换在同一数据库事务内提交。

## 数据模型

### Review Decision

审核决定表保存：

- decision ID；
- project ID；
- knowledge key、ID 和版本；
- 精确 review revision；
- APPROVE 或 REQUEST_CHANGES；
- reviewer、UTC 时间和原因；
- 完整 JSONB 决策对象。

数据库唯一约束：

```text
projectId + knowledgeKey + reviewRevision + reviewer
```

同一审核人不能对同一 review revision 重复提交决定。

### Snapshot Envelope

快照表保存：

- snapshot ID；
- 64 位 SHA-256 digest；
- project、environment 和 release；
- 创建主体、时间和原因；
- 完整 JSONB envelope。

数据库检查 snapshot ID 后 12 位与 digest 前 12 位一致，并校验 envelope 与关系字段一致。完整 digest 仍由确定性 JavaScript 校验器重新计算。

## Append-only 与 Immutable

review decision 和 snapshot envelope 均设置 UPDATE/DELETE 拒绝触发器：

- 审核决定只能追加；
- 快照一经保存不可修改或删除；
- 相同 snapshot ID 只允许完全一致的幂等写入。

## Governance Unit of Work

新增 `GovernanceUnitOfWorkPort`：

```text
execute(work)
  └── work({ registry, reviewStore, snapshotStore })
```

内存环境使用 passthrough 实现。PostgreSQL 实现：

1. 从 Pool 获取一个 client；
2. 开启单个事务；
3. 创建绑定该 client 的 Registry、Review Store 和 Snapshot Store；
4. 执行治理回调；
5. 全部成功后 COMMIT，任意失败则 ROLLBACK。

## 原子治理操作

以下流程必须通过 Unit of Work：

- 创建、编辑、提交、废弃和归档；
- APPROVE 决策追加；
- REQUEST_CHANGES 决策追加与 `REVIEWING → DRAFT`；
- 当前 revision 审核证据读取与 `REVIEWING → PUBLISHED`；
- 快照持久化。

授权检查可在事务前执行，但事务内必须重新读取 Registry revision 并通过 CAS 防止 TOCTOU。

## 并发行为

- 两个并发发布命令只能有一个成功；
- Registry 历史只能出现一个 PUBLISHED 转换；
- 同一审核人并发提交两个决定只能有一个成功；
- 事务中任意异常必须同时回滚 Registry 与审核决定。

## Migration

治理 migration 使用独立 schema migration 表、SHA-256 checksum、事务级 advisory lock 和整体回滚。

Registry migration 必须先应用，因为审核决定通过外键引用 Registry record。

## 明确不包含

- HTTP API；
- 身份认证和组织同步；
- RBAC 管理后台；
- AI 自动审核或发布；
- 自动废弃旧知识版本；
- k6 Worker、队列或生产执行。

## 验收标准

- PostgreSQL Store 通过 M1-C 可复用合同；
- 审核决定与快照可跨适配器实例恢复；
- 数据库拒绝审核和快照修改/删除；
- 数据库拒绝 digest 与 envelope 不一致；
- migration 幂等、checksum 受保护且失败回滚；
- Unit of Work 失败时所有写入回滚；
- REQUEST_CHANGES 原子提交；
- 并发发布只有一个成功；
- 并发重复审核被唯一约束拒绝；
- M1-A、M1-B、M1-C 全部回归测试继续通过。
