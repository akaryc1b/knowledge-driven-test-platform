# @kdtp/test-plan

执行器无关的确定性测试规划合同。

本 Package 提供：

- 版本化 Planning Request、Target Inventory、Test Intent、Coverage Obligation 与 Test Plan；
- immutable knowledge snapshot 与 capability catalog 精确绑定；
- canonical JSON、SHA-256 fingerprint、确定性 Plan/Intent/Obligation/Provenance ID；
- 执行器脚本和敏感运行数据拒绝；
- defensive copy 与稳定错误码；
- 不依赖 PostgreSQL、HTTP 或任何测试执行器。

M2-A 只建立合同和身份。Capability Catalog 与 Planner 分别由 M2-B、M2-C 实现。
