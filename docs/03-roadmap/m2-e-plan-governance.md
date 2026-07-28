# M2-E — Plan Governance and Review

## 目标

在 M2-D Durable Registry 之上建立项目授权、职责分离、revision-bound review、Coverage Gate 与 Freeze Gate。治理服务只接受确定性计划和结构化证据，不允许 AI 自动批准、冻结或修改正式计划。

## 治理动作

```text
PLAN_CREATE
PLAN_GENERATE
PLAN_EDIT
PLAN_SUBMIT
PLAN_REVIEW
PLAN_APPROVE
PLAN_FREEZE
PLAN_READ
PLAN_AUDIT_READ
```

项目成员缺失、暂停、撤销、未生效、过期或动作未映射时默认拒绝。

## 职责分离

1. 计划生成者可以提交计划；
2. 计划生成者不能审核自己的计划；
3. 审核人不能作为最终冻结人；
4. Review Decision 绑定精确 plan revision；
5. DRAFT 内容修改后旧 review evidence 不再满足当前 revision；
6. `REQUEST_CHANGES` 返回 DRAFT；
7. 高风险计划需要两个不同审核人；
8. AI、Automation 或 Planner 身份不能自动批准或冻结。

## Coverage Gate

- Mandatory obligation 不得为 `UNPLANNED`；
- `EXEMPT` 必须具有结构化 reason、owner 和批准证据；
- `PARTIAL` 是否阻断由确定性治理策略显式决定；
- APPROVE 与 FREEZE 都重新计算当前 revision 的 gate；
- Freeze 只接受 APPROVED 当前 revision 和满足条件的审核证据。

## 审计

治理时间线组合：

- Registry lifecycle/history；
- review decision；
- request changes；
- approval gate result；
- freeze gate result；
- actor、动作、plan revision、时间和结构化原因。

所有读取按 projectId 授权和隔离。

## 本切片不包含

- 跨 Store PostgreSQL Unit of Work；
- CLI 规划编排；
- HTTP 写路由；
- k6、Worker、Queue、Scheduler、Kubernetes Job 或测试执行；
- M3。
