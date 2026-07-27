# M2-A 当前开发交接

## M1 已完成并合并

- M1-A～M1-K 已合并到 `main`；
- 当前版本为 `0.12.0`；
- PostgreSQL Registry、治理证据、项目成员、OIDC/JWKS、只读服务和 Kubernetes 基线已经存在；
- M1-RC1 候选证据独立保留，生产资格仍受外部镜像 digest、生产 Secret、目标集群和发布批准阻断；
- 当前业务 HTTP 仍只有五条只读知识查询路由。

## M2-A 文档决策

- 正式计划只消费 `PUBLISHED` Knowledge 的不可变 Snapshot Envelope；
- Snapshot ID 与 SHA-256 digest 必须同时绑定；
- `planId` 与 `intentId` 使用 canonical JSON 和 SHA-256 确定性派生；
- 时间、随机数、数据库序列和对象插入顺序不得参与正式身份；
- Test Intent 保持执行器无关；
- Secret、Token、私钥、连接串和运行节点信息在合同入口拒绝；
- 所有输入和输出 defensive copy；
- JSON Schema 与运行时验证共享版本化合同和稳定错误码。

## 本切片允许

- `packages/test-plan/` 领域模型；
- `schemas/planning/` 五个 v1 合同；
- canonical JSON、SHA-256、规划 fingerprint、plan ID 与 intent ID；
- Target Inventory、Planning Policy、Intent、Coverage Obligation、Provenance 与 Test Plan 验证；
- 内存测试、Schema 测试、示例和仓库校验扩展；
- M1 全量回归。

## 本切片不允许

- Capability Catalog 实现；
- Deterministic Planner；
- PostgreSQL 计划 Registry；
- 计划审核、批准或冻结；
- HTTP 写接口；
- k6、xk6、Playwright、Worker、Queue、Scheduler 或生产测试执行；
- M3。

## 下一安全切片

`M2-B — Versioned Capability Catalog`

只允许建立执行器无关、版本化、可解析、可校验和可计算 digest 的 Capability Catalog，并继续禁止任何实际执行器代码。
