# M2-F 当前开发交接

## M2-D 与 M2-E 已完成

- PostgreSQL Durable Test Plan Registry、CAS、行锁、唯一 fingerprint、append-only history 和 review evidence；
- FROZEN、Snapshot/Catalog binding 与 lifecycle 数据库防篡改；
- project authorization、职责分离、revision-bound review、Coverage Gate 和 Freeze Gate；
- M2-D PostgreSQL 54/54 通过；
- M2-E Node、PostgreSQL、部署、M1 Release 与 Docker 硬化 CI 通过。

## M2-F 允许

- Planning Unit of Work 与 transaction-bound Registry/Governance；
- 同一输入幂等生成；
- Review Decision、REQUEST_CHANGES、APPROVE、FREEZE 与 lifecycle 原子提交；
- 并发生成、审核、批准和冻结测试；
- 失败整体回滚；
- Durable Audit Timeline；
- `kdtp-plan generate|validate|show|coverage` CLI；
- PostgreSQL 真实完整生命周期示例。

## M2-F 不允许

- HTTP 写路由；
- 执行器、Worker、Queue、Scheduler、Kubernetes Job；
- 测试执行、结果采集、Allure 或 M3。

第二批完成后统一汇报，不自动合并任何 PR。
