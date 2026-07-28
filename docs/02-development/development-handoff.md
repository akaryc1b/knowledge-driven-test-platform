# M2-B 当前开发交接

## M2-A 已完成

- 执行器无关 Test Planning v1 合同；
- Target Inventory 与 Planning Policy；
- Snapshot ID + digest 双绑定；
- canonical JSON、SHA-256、确定性 plan/intent/coverage/provenance identity；
- PUBLISHED-only 知识约束；
- Secret 与执行器脚本拒绝；
- defensive copy 与稳定错误码；
- M1 全量回归和 PostgreSQL 18 CI 已通过。

## M2-B 允许

- `packages/test-capability/`；
- `schemas/capability/`；
- `CapabilityCatalogPort` 与内存 Adapter；
- 精确 ID/version 解析；
- Target Kind 兼容性；
- 禁用和重复能力拒绝；
- 稳定排序、Catalog version/digest；
- 共享 Contract 测试和基础能力数据示例。

## M2-B 不允许

- k6、xk6、Playwright、SQL 或 WebSocket 执行脚本；
- Planner、Coverage Matrix 或 Provenance DAG；
- PostgreSQL 计划持久化；
- 审核、批准、冻结或写入 HTTP API；
- Worker、Queue、Scheduler、Kubernetes Job、测试执行或 M3。

## 下一安全切片

`M2-C — Deterministic Planner and Coverage`

只允许把不可变 Snapshot、Target Inventory、Capability Catalog 和 Planning Policy 转换为稳定 Test Plan、Coverage、Provenance 与无环依赖 DAG。
