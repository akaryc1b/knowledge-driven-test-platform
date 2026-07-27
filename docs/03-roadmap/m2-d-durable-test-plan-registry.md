# M2-D — Durable Test Plan Registry

## 目标

将 M2-C 产生的确定性 Test Plan 持久化为可并发控制、可恢复、可审计的 PostgreSQL Registry，同时保持规划内容、知识快照和 Capability Catalog 的精确绑定。

## 生命周期

```text
DRAFT
  ↓
REVIEWING
  ↓
APPROVED
  ↓
FROZEN
  ↓
SUPERSEDED
  ↓
ARCHIVED
```

`REVIEWING → DRAFT` 和 `APPROVED → DRAFT` 只能由后续治理层通过显式 Request Changes 操作触发。M2-D 仅提供受验证的状态转换原语和持久化，不定义角色审批策略。

## 数据模型

M2-D 新增：

```text
test_plan_records
test_plan_history
test_plan_review_decisions
test_plan_schema_migrations
```

当前计划内容以一个原子 JSONB envelope 持久化，Coverage、Provenance 和 DAG 与同一 plan revision 一致提交。Review Decision 表在 M2-D 建立耐久结构和精确 revision 约束，正式治理规则由 M2-E 使用。

## 核心约束

1. `plan_id` 唯一；
2. 输入 fingerprint 唯一，防止同一输入产生多个有效计划；
3. Snapshot ID/digest 和 Catalog version/digest 不可变；
4. 所有修改使用 revision CAS 与行锁；
5. 历史表 append-only；
6. FROZEN 内容不可修改；
7. migration 具有 checksum、幂等和整体事务回滚；
8. PostgreSQL Adapter 与内存 Adapter 共享合同测试；
9. 并发创建只有一个成功；
10. 并发状态转换只有一个成功；
11. Adapter 重启后可恢复完整计划和历史；
12. 数据库约束不得为测试便利而移除。

## 事务边界

每次 create、replace draft、transition 和 review evidence append 均在单数据库事务内完成。领域包不创建连接池；PostgreSQL Adapter 可以绑定外部事务 executor，为 M2-F 的 Unit of Work 留出组合边界。

## 本切片不包含

- 角色动作映射或审批职责分离；
- Coverage Approval/Freeze Gate；
- CLI 编排；
- HTTP 写 API；
- k6、Worker、Queue、Scheduler 或任何测试执行；
- M3。
