# M2-F — Durable Planning Orchestration

## 目标

将确定性 Planner、Durable Test Plan Registry 与 Plan Governance 组合为 PostgreSQL 原子工作流。相同输入只能产生一个有效计划，Review Decision、生命周期和 Freeze Gate 必须在同一事务中提交或整体回滚。

## 原子工作流

```text
Published Snapshot
  ↓
Generate Plan (idempotent)
  ↓
Submit
  ↓
Review / Request Changes
  ↓
Approve
  ↓
Freeze
  ↓
Reload from PostgreSQL
```

## 必须能力

- `PlanningUnitOfWorkPort`；
- PostgreSQL Unit of Work，绑定同一个 transaction client；
- 生成幂等键和输入 fingerprint；
- 同一输入并发生成只有一个有效计划；
- Planner 结果、Snapshot 和 Capability Catalog 原子绑定；
- Review Decision 与生命周期原子提交；
- Approval/Freeze Gate 与状态转换原子提交；
- 并发生成、审核、批准和冻结测试；
- 失败整体回滚；
- Durable Audit Timeline；
- CLI 只调用应用服务，不复制 Planner 或治理逻辑。

## CLI

```text
kdtp-plan generate
kdtp-plan validate
kdtp-plan show
kdtp-plan coverage
```

CLI 输入输出为稳定 JSON；凭证、连接串、Token 和私钥不得出现在计划、输出或审计证据中。

## 本切片不包含

- HTTP 写 API；
- 计划可视化编辑器；
- k6/xk6、Playwright、Worker、Queue、Scheduler、Kubernetes Job；
- 测试执行、结果采集或 Allure；
- M3。
