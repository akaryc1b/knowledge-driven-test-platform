# ADR-0018：PostgreSQL Durable Test Plan Registry

- 状态：Accepted
- 日期：2026-07-28

## 背景

M2-C 能稳定生成 Test Plan、Coverage、Provenance 和 Dependency DAG，但内存结果无法支持跨进程审核、并发治理、重启恢复或 FROZEN 不可变性。计划身份由确定性输入决定，因此持久化层必须保留身份和内容，而不能重新计算或隐式绑定“最新”知识。

## 决策

1. 新增 `@kdtp/test-plan-postgres`，实现共享 Test Plan Registry Port；
2. 计划 envelope、Coverage、Provenance 和 DAG 作为一个 revision 原子持久化；
3. 使用 `plan_id` 和输入 fingerprint 双唯一约束；
4. 所有可变操作使用行锁与 revision CAS；
5. Snapshot ID/digest、Catalog version/digest 和输入 fingerprint 在创建后不可修改；
6. FROZEN 计划由数据库触发器和领域校验双重保护；
7. 历史记录和 review decision 为 append-only；
8. migration 记录 name、checksum 和 applied_at，并在一个事务中执行；
9. Adapter 支持外部事务 executor，不在领域服务内嵌连接池；
10. PostgreSQL 18 集成测试覆盖并发、回滚、重启恢复和防篡改。

## 结果

优点：

- 计划可在进程重启后恢复；
- 确定性身份与数据库唯一约束一致；
- 为 M2-E/M2-F 提供稳定治理和事务底座；
- FROZEN、历史和绑定关系不依赖应用自律。

代价：

- JSONB envelope 查询能力有限，细粒度读取将在 M2-G 通过稳定投影解决；
- 状态机和数据库约束需要同步维护；
- Review Decision 表先于治理服务建立，但不能绕过 M2-E 的授权与职责分离。
