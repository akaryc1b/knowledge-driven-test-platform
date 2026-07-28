# ADR-0019：Revision-Bound Plan Governance and Freeze Gate

- 状态：Accepted
- 日期：2026-07-28

## 背景

Durable Test Plan Registry 可以保存计划、历史和 review decision，但低层状态转换不能决定授权、职责分离或 Coverage 是否足以批准。若只检查状态而不检查当前 revision 的审核和覆盖证据，旧审核可能错误地批准已修改内容。

## 决策

1. 新增 `@kdtp/test-plan-governance`，组合项目授权和 Test Plan Registry Port；
2. 所有动作先执行 project authorization，未显式授权则拒绝；
3. review decision 必须绑定当前 plan revision；
4. 作者、审核人和冻结人保持职责分离；
5. 高风险计划需要两个不同 APPROVE reviewer；
6. REQUEST_CHANGES 原子记录证据并返回 DRAFT；
7. APPROVE 与 FREEZE 运行确定性 Coverage Gate；
8. Mandatory UNPLANNED 阻断，EXEMPT 必须具有 reviewer 批准证据；
9. FREEZE 重新验证当前 revision、审核人数和 gate，不信任过去缓存结果；
10. 治理时间线只包含结构化、脱敏证据；AI 和 Automation 身份不得自动批准或冻结。

## 结果

优点：旧审核不会跨 revision 生效，职责分离和覆盖门禁可复用且可测试。

代价：每次 APPROVE/FREEZE 需要读取当前计划及审核证据；跨 Store 原子提交延后到 M2-F。
