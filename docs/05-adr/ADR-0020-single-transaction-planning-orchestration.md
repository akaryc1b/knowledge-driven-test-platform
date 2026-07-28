# ADR-0020：Single-Transaction Durable Planning Orchestration

- 状态：Accepted
- 日期：2026-07-28

## 背景

M2-C、M2-D 和 M2-E 分别提供 Planner、Registry 与治理规则，但跨步骤调用若使用不同数据库事务，可能出现 review evidence 已写入而状态未变化、Freeze Gate 已通过而计划未冻结，或并发生成产生重复处理。

## 决策

1. 新增 Planning Orchestration 应用边界和 `PlanningUnitOfWorkPort`；
2. PostgreSQL Unit of Work 获取一个 client，并以 BEGIN/COMMIT/ROLLBACK 包裹完整命令；
3. 事务内创建绑定该 client 的 Registry 和 Governance 服务；
4. Generate 使用确定性 input fingerprint 和数据库唯一约束实现幂等；
5. duplicate generate 读取并返回既有相同计划，不生成新身份；
6. review、request changes、approve 和 freeze 在同一事务完成 evidence 与 lifecycle；
7. 每个命令在事务内重新读取并校验当前 revision，避免 TOCTOU；
8. Audit Timeline 从持久化 history 和 review decisions 重建；
9. CLI 只调用 orchestration service；
10. 正式执行仍只允许未来消费 FROZEN 计划，本切片不实现任何执行功能。

## 结果

优点：计划身份、证据、状态和 Gate 结果不会出现部分提交，并发结果由数据库锁、CAS 和唯一约束决定。

代价：应用服务需要显式事务绑定工厂；长事务必须保持边界有界，不能在事务中访问外部服务或执行测试。
