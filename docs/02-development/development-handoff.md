# M2-E 当前开发交接

## M2-D 已完成

- Durable Test Plan Registry Port、内存和 PostgreSQL 18 Adapter；
- checksum migration、CAS、行锁、唯一 fingerprint、restart recovery；
- append-only history/review evidence；
- FROZEN、Snapshot/Catalog binding 和生命周期数据库防篡改；
- 最终 CI PostgreSQL 54/54 通过。

## M2-E 允许

- `packages/test-plan-governance/`；
- PLAN_CREATE/GENERATE/EDIT/SUBMIT/REVIEW/APPROVE/FREEZE/READ/AUDIT_READ；
- 默认拒绝项目角色动作映射；
- 作者、审核人、冻结人职责分离；
- revision-bound review 和 REQUEST_CHANGES；
- Mandatory Coverage、EXEMPT evidence、风险双审核和 Freeze Gate；
- 脱敏治理审计时间线。

## M2-E 不允许

- 跨 Store PostgreSQL Unit of Work；
- CLI、HTTP 写 API；
- k6、xk6、Playwright、Worker、Queue、Scheduler、Kubernetes Job 或测试执行；
- M3。

M2-E 通过后自动继续 M2-F。
