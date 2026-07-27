# ADR-0017：Planner 使用纯确定性规则生成 Coverage、Provenance 与 DAG

- 状态：Accepted
- 日期：2026-07-27

## 背景

正式 Test Plan 必须能够由相同的 M1 Snapshot、Target Inventory、Capability Catalog 和 Planning Policy 完整重现。若 Planner 依赖 LLM、当前时间、隐式最新 Catalog、异步完成顺序或非稳定集合遍历，计划身份、Coverage 和审核证据都会漂移。

## 决策

1. Planner 只接受已验证且内容寻址的 Planning Request 与精确 Capability Catalog；
2. Planner 不调用 AI、网络服务、数据库或执行器；
3. Policy Selector 通过纯函数匹配知识与 Target；
4. 每个知识、Target、Capability、Policy Entry 组合产生一个确定性 Coverage Obligation；
5. Exemption 必须在 Policy 中精确声明 reason 与 owner，Planner 不自动豁免；
6. Intent 由执行器无关 Strategy 生成，并经过 canonical normalization、去重与冲突检测；
7. Capability dependency rules 转换为 Intent DAG，循环依赖必须拒绝；
8. 拓扑排序始终使用稳定 Intent ID 作为并列决策；
9. Coverage Matrix 与 Provenance Graph 是正式规划结果的一部分，并计算独立 result digest；
10. 能力缺失、禁用、不兼容或必需依赖缺失保留为 `UNPLANNED` 和结构化 unsupported evidence；
11. 正式 Test Plan 仍为 `DRAFT` revision 1，后续治理阶段决定是否可批准和冻结。

## 结果

优点：

- 相同输入产生完全相同计划和附属证据；
- 不支持的覆盖不会被静默丢弃；
- Review 可以从 Intent 反向追踪到知识、Snapshot、Capability、Target 与 Policy；
- 后续执行器只需消费 FROZEN Intent，不参与正式规划身份。

代价：

- Strategy 能力受版本化声明限制，不能依赖生成式自由文本；
- Capability 依赖需要显式建模；
- DRAFT 计划可能包含 `UNPLANNED`，必须由后续 Governance Gate 阻断批准或冻结。
