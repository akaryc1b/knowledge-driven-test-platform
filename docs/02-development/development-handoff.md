# M2-C 当前开发交接

## M2-A 与 M2-B 已完成

- 执行器无关 Test Planning v1 合同与确定性身份；
- PUBLISHED-only Snapshot ID/digest 双绑定；
- 版本化 Capability Catalog、精确 ID/version 解析与 Catalog digest；
- Target Kind 兼容性、禁用与重复能力拒绝；
- Secret、执行器脚本与运行基础设施拒绝；
- M1 全量回归和 PostgreSQL 18 CI 已通过。

## M2-C 允许

- `packages/test-planner/`；
- `TestPlannerPort` 与 `PlanningStrategyPort`；
- 确定性内存 Planner；
- Policy Selector 匹配；
- Intent 去重与冲突检测；
- Capability dependency DAG、循环检测与稳定拓扑排序；
- Coverage Obligation、Coverage Matrix 和 Unsupported evidence；
- 完整 Provenance Graph；
- 稳定 result digest 与端到端规划示例。

## M2-C 不允许

- PostgreSQL Test Plan Registry；
- Review、Approve、Freeze 或 HTTP 写接口；
- k6、xk6、Playwright、SQL/WebSocket 执行代码；
- Worker、Queue、Scheduler、Kubernetes Job、结果采集、Allure 或 M3。

## 下一安全批次

收到确认后进入第二批：

```text
M2-D Durable Test Plan Registry
  ↓
M2-E Plan Governance and Review
  ↓
M2-F Durable Planning Orchestration
```

在第一批统一验收前不得启动 M2-D。
