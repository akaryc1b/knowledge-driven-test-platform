# M2-C — Deterministic Planner and Coverage

## 目标

把不可变知识快照、Target Inventory、精确 Capability Catalog 与 Planning Policy 转换为可复现的 Test Plan、Coverage Matrix、Provenance Graph 和无环 Dependency DAG。

Planner 是纯确定性应用服务，不调用大语言模型，不读取隐式最新知识，不包含执行器脚本，也不执行测试。

## 新增结构

```text
packages/test-planner/
examples/deterministic-test-plan.js
```

核心端口：

- `TestPlannerPort`：接受完整且已验证的规划输入，返回正式规划结果；
- `PlanningStrategyPort`：把一项已匹配的知识、目标和能力转换为执行器无关 Intent 规格；
- `DeterministicTestPlanner`：默认内存实现；
- `DeclarativePlanningStrategy`：第一版无执行器、无 AI 的确定性策略。

## 确定性流程

1. 验证 Planning Request 与 Capability Catalog 的 version/digest 精确绑定；
2. 对知识、目标、Policy Entry 和 Capability Reference 使用稳定排序；
3. 按 Selector 生成 Coverage Obligation 候选；
4. 精确解析 Capability 并验证 Target Kind；
5. 应用显式 Exemption，禁止隐式忽略；
6. 生成、规范化并去重 Test Intent；
7. 检测同一逻辑身份的冲突 Intent；
8. 根据 Capability dependency rules 建立 DAG；
9. 检测循环并进行稳定拓扑排序；
10. 生成 Coverage Obligations、Coverage Matrix、Provenance Graph 与 Test Plan；
11. 对完整结果计算 canonical digest。

任何对象输入顺序、Map/Set 插入顺序和异步 Capability 解析完成顺序均不得改变结果。

## Coverage 语义

- `COVERED`：Obligation 至少绑定一个有效 Intent；
- `PARTIAL`：矩阵聚合单元中同时存在已覆盖与未覆盖 Obligation；
- `UNPLANNED`：能力缺失、禁用、不兼容或必需依赖缺失，且没有显式 Exemption；
- `EXEMPT`：Planning Policy 中存在精确匹配、包含 reason 与 owner 的结构化 Exemption。

Mandatory Obligation 可以在 DRAFT 计划中保持 `UNPLANNED`，但必须被结果中的 `unsupportedObligations` 明确列出，供 M2-E Coverage Gate 拒绝批准或冻结。

## Provenance

每个 Intent 的每条来源知识都必须产生精确 Provenance：

- knowledge ID/version/boundary；
- snapshot ID/digest；
- capability ID/version；
- target ID；
- policy entry ID；
- intent ID。

## Dependency DAG

Capability dependency rule 支持：

- `same-target`：依赖同一 Target 上的指定 Capability；
- `any-target`：依赖计划中稳定选择的全部匹配 Intent；
- `required=true`：缺失时当前 Obligation 进入 `UNPLANNED`；
- `required=false`：存在时建立边，不存在时不阻断。

DAG 节点使用最终 Intent ID，边使用 `dependency → dependent` 方向。拓扑排序以 Intent ID 为稳定次序。

## 稳定错误

至少包含：

- `PLANNER_CATALOG_BINDING_MISMATCH`；
- `INVALID_PLANNER_INPUT`；
- `INTENT_CONFLICT`；
- `DEPENDENCY_CYCLE`；
- `UNSUPPORTED_OBLIGATION`；
- `NON_DETERMINISTIC_PLANNING_RESULT`。

## 验收

1. 相同输入反复规划得到完全相同的 JSON、Plan ID、Plan digest 与 result digest；
2. 输入集合顺序变化不影响结果；
3. Selector、Capability 兼容性与禁用能力按稳定规则处理；
4. Intent 精确去重且冲突被拒绝；
5. 必需依赖缺失产生 `UNPLANNED`，循环依赖被拒绝；
6. 拓扑排序稳定；
7. Coverage Matrix 能聚合 `COVERED/PARTIAL/UNPLANNED/EXEMPT`；
8. 所有 Intent 具有完整 Provenance；
9. M1、M2-A、M2-B 全量回归和 PostgreSQL 18 CI 继续通过。

## 明确不包含

- PostgreSQL Test Plan Registry；
- 审核、批准、冻结或 Coverage Gate 状态转换；
- HTTP 写接口；
- k6、xk6、Playwright、SQL/WebSocket 执行代码；
- Worker、Queue、Scheduler、Kubernetes Job、结果采集、Allure 或 M3。
