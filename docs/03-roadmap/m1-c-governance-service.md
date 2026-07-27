# M1-C — Governance Service Boundary

## 目标

在 Registry 与持久化 Adapter 之上建立项目级治理编排，使知识从“可存储”升级为“只有经过授权、职责分离和审核策略后才能发布”。

## 本轮能力

- `ProjectAuthorizationPort`：按项目、主体和动作进行授权；
- `ReviewDecisionStorePort`：追加保存审核决策；
- `KnowledgeSnapshotStorePort`：不可变保存执行知识快照；
- `KnowledgeGovernanceService`：编排创建、编辑、提交、审核、发布、废弃、归档和快照保存；
- `GovernanceAuditQueryService`：合并 Registry 历史和审核决策；
- 内存授权、审核决策和快照适配器；
- 可复用 Port 合同测试。

## 治理动作

```text
KNOWLEDGE_CREATE
KNOWLEDGE_EDIT
KNOWLEDGE_SUBMIT
KNOWLEDGE_REVIEW
KNOWLEDGE_PUBLISH
KNOWLEDGE_DEPRECATE
KNOWLEDGE_ARCHIVE
AUDIT_READ
SNAPSHOT_PERSIST
SNAPSHOT_READ
```

每个动作都必须携带明确的 `projectId` 和 `actor`，授权端口默认拒绝未配置主体。

## 职责分离

默认策略：

- 原始作者负责提交审核；
- 作者不得审核自己的知识；
- 作者不得发布自己的知识；
- 审核人与发布人均需要项目级显式授权；
- PROJECT 作用域的知识必须与治理项目一致。

原始作者来自 Registry 第一条 `CREATED` 审计事件，不依赖可被修改的知识正文。

## Revision 绑定审核

审核决策绑定以下身份：

```text
projectId + knowledgeKey + reviewRevision + reviewer
```

`reviewRevision` 是知识进入当前 `REVIEWING` 周期后的精确 Registry revision。草稿被退回、修改和重新提交后 revision 会变化，旧审批不会计入新发布决策。

同一审核人不能对同一 review revision 重复写入决定。审核记录为追加式对象，不支持覆盖。

## 风险分级策略

默认审批数量：

| 风险 | 最少不同审核人 |
|---|---:|
| low | 1 |
| medium | 1 |
| high | 1 |
| critical | 2 |

项目可以在组合根中加强数量，但不能通过命令临时降低。

## 审核决策

M1-C 支持：

- `APPROVE`：追加批准证据，知识保持 `REVIEWING`；
- `REQUEST_CHANGES`：追加退回证据，并将知识转换回 `DRAFT`。

最终发布是独立命令。发布服务读取当前 revision 的审核证据，满足治理策略后才调用 Registry 的 `REVIEWING → PUBLISHED` 转换。

## 快照持久化边界

快照保存前必须验证：

- `snapshotId` 与项目和 digest 一致；
- digest 与规范化 payload 一致；
- 快照项目与授权项目一致；
- 环境与发布版本来自快照 context；
- 同一 snapshot ID 只能保存完全相同的 envelope。

快照保存端口不负责生成快照；快照仍由 `knowledge-core` 确定性构建。

## 审计查询

审计查询将以下事件合并为时间线：

- Registry 创建、草稿替换和状态转换；
- 审核批准与退回决定。

查询同样执行项目授权，禁止通过审计接口跨项目读取知识或快照。

## 一致性边界

M1-C 只定义服务边界和内存实现，不承诺 Registry、审核决策存储和快照存储之间的跨资源原子事务。持久化治理 Unit of Work 留给后续安全切片。

## 明确不包含

- HTTP API；
- 身份认证、组织同步或 RBAC 管理后台；
- PostgreSQL 治理决策 Adapter；
- AI 自动审核或发布；
- 自动废弃旧版本；
- k6 Worker、任务队列和生产执行。

## 验收标准

- 未授权主体无法执行治理动作；
- 作者无法自审和自发；
- critical 知识必须至少两名不同审核人；
- 旧 revision 审批不能用于新提交；
- 项目授权和 PROJECT 作用域均隔离；
- 审核与快照存储提供防御性副本；
- 快照 digest 被重新校验；
- 审计时间线可复现；
- 所有内存适配器通过可复用合同测试。
