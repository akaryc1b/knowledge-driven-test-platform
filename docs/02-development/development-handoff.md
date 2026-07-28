# M2-E 当前开发交接

## M2-E 已完成

- `packages/test-plan-governance/` 项目授权治理服务；
- PLAN_CREATE、PLAN_GENERATE、PLAN_EDIT、PLAN_SUBMIT、PLAN_REVIEW、PLAN_APPROVE、PLAN_FREEZE、PLAN_READ、PLAN_AUDIT_READ；
- 项目角色默认拒绝映射，Automation 只能生成和读取，不能批准或冻结；
- 只有生成者可以提交，生成者不能审核自己的计划；
- 审核人不能作为最终冻结人；
- Review Decision 精确绑定当前 plan revision；
- REQUEST_CHANGES 记录证据并返回 DRAFT；
- Mandatory UNPLANNED、结构化 EXEMPT evidence 和高风险双审核 Gate；
- APPROVE 与 FREEZE 都重新计算当前 revision 的确定性 Coverage Gate；
- Registry history 与 review decision 组成项目隔离、脱敏审计时间线；
- 本地干净安装回归为 237 项测试、232 通过、5 项仅因未配置 PostgreSQL URL 跳过；
- 治理示例完成 DRAFT → REVIEWING → APPROVED → FROZEN，最终 revision 为 4；
- M1 全量回归、部署和 Release Validator 保持不变。

## 当前边界

- M2-E 使用 Registry Port 编排治理，但多步骤 review/transition 的 PostgreSQL 原子事务由 M2-F 提供；
- 没有 HTTP 写路由、执行器、Worker、Queue、Scheduler、Kubernetes Job 或 M3。

## 同批次下一切片

`M2-F — Durable Planning Orchestration`

只允许：

- Planning Unit of Work 与 PostgreSQL 原子工作流；
- 同一输入的幂等生成；
- Review Decision、Approval、Freeze Gate 与生命周期原子提交；
- 并发生成、审核和冻结测试；
- Durable Audit Timeline；
- `kdtp-plan generate|validate|show|coverage` CLI；
- Published Snapshot → Generate → Submit → Review → Approve → Freeze → PostgreSQL reload 示例。
