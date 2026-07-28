# M2-G 当前开发交接

## M2-A～M2-F 已完成

- 确定性 Test Planning contracts、Capability Catalog、Planner、Coverage、Provenance 与 DAG；
- Durable Test Plan Registry、PostgreSQL 18 migration、CAS、行锁、唯一 fingerprint 和防篡改；
- Plan Governance、职责分离、revision-bound review、Coverage Gate 与 Freeze Gate；
- Planning Unit of Work、幂等生成、证据与生命周期原子回滚；
- `kdtp-plan generate|validate|show|coverage` CLI；
- M2-F 本地 247 项测试、241 通过、6 项 PostgreSQL-only 跳过；
- M2-F PostgreSQL 18 为 58/58，最终 CI、部署、M1 Release 和 Docker 硬化通过。

## M2-G 允许

- `packages/test-plan-query/`；
- `packages/test-plan-http/`；
- Test Plan list/detail/coverage/provenance/timeline 五条只读查询；
- `PLAN_READ` 与 `PLAN_AUDIT_READ` 项目授权；
- 稳定 DTO、过滤、排序和 opaque cursor；
- 复用现有 OIDC/JWKS AuthenticationPort、限流、Request ID、安全 Header 和脱敏错误；
- 真实临时 Node HTTP Server 合同测试。

## M2-G 不允许

- 计划写入 HTTP API；
- 远程 generate、submit、review、approve 或 freeze；
- 应用服务组合、Kubernetes 变更或 M2 Release Candidate；
- 执行器、Worker、Queue、Scheduler、Kubernetes Job、测试执行、结果采集、Allure 或 M3。

M2-G 通过后自动继续 M2-H，再继续 M2-I；不自动合并任何 PR。
