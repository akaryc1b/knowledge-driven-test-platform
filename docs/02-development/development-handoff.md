# M2-H 当前开发交接

## M2-A～M2-G 已完成

- 确定性 Test Planning、Capability Catalog、Planner、Coverage、Provenance 与 DAG；
- Durable Test Plan Registry、PostgreSQL 18 migration、CAS、行锁、唯一 fingerprint 与数据库防篡改；
- Plan Governance、职责分离、revision-bound review、Coverage Gate 与 Freeze Gate；
- Planning Unit of Work、幂等生成、证据与 lifecycle 原子回滚；
- Test Plan list/detail/coverage/provenance/timeline 五条只读路由；
- `PLAN_READ` 与 `PLAN_AUDIT_READ` 项目隔离授权；
- M2-G 本地 268 项测试、262 通过、6 项 PostgreSQL-only 跳过；
- M2-G PostgreSQL 18 为 58/58，最终 CI `30328466025`、部署、M1 Release 与 Docker 硬化通过。

## M2-H 允许

- 扩展 `apps/read-only-governance-service/`；
- 同一端口组合五条 Knowledge 与五条 Test Plan 只读路由；
- 共享 OIDC/JWKS、Subject Mapping、RateLimiter、Request ID 和 Project Membership；
- 启动时应用 Test Plan PostgreSQL migration；
- 同一 PostgreSQL Pool 与统一 readiness；
- 真实 PostgreSQL/JWKS/JWT/Membership 十路由 E2E；
- PostgreSQL outage/recovery、JWKS fault、migration failure 和 graceful shutdown 验收；
- 更新只读部署文档与示例配置，但不开放外部入口或写权限。

## M2-H 不允许

- 计划或知识写入 HTTP API；
- M2 Release Candidate 或 M2 发布资格声明；
- Planner/Governance 命令的远程调用；
- 执行器、Worker、Queue、Scheduler、Kubernetes Job、测试执行、结果采集、Allure 或 M3。

M2-H 通过后自动继续 M2-I；不自动合并任何 PR。
