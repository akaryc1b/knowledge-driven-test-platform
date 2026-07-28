# ADR-0022：Unified Read-Only Knowledge and Test Plan Service Composition

- 状态：Accepted
- 日期：2026-07-28

## 背景

M1 已提供受 OIDC/JWKS、Project Membership、限流和运维探针保护的五条 Knowledge 只读路由；M2-G 新增五条 Test Plan 只读路由。运行两个独立服务会复制认证、限流、数据库 Pool、JWKS 缓存、Kubernetes 配置和故障语义，并增加跨服务配置漂移风险。

## 决策

1. 扩展现有 `read-only-governance-service`，不创建第二个网络服务；
2. 一个 Node HTTP Server 在 Operational handler 内分派 Knowledge 或 Test Plan 业务 handler；
3. Route Matcher 必须确定性且互斥，未知路由保持稳定 404；
4. 两类业务 Transport 共享同一个 AuthenticationPort、JWKS Provider、Subject Mapper、RateLimiter、Request ID Factory 和 clock；
5. 两类 Query Service 共享同一个 PostgreSQL Pool 和 Project Membership Authorization Adapter；
6. 启动时依次应用 Knowledge Registry、Knowledge Governance、Project Membership 和 Test Plan Registry 四组 migration；
7. migration 与 JWKS warm-up 全部成功前不得监听；
8. readiness 继续以 PostgreSQL 与 JWKS 为依赖，不因路由数量复制探针；
9. Runtime Event 只记录固定类型和有界元数据，不记录敏感输入；
10. 组合根只注入只读查询能力，不注入 Planner、Governance 命令或测试执行能力。

## 结果

优点：十条只读路由共享一致安全和运维语义，避免重复连接池与认证缓存，数据库故障恢复可以在同一进程内验证。

代价：组合根承担明确的路由分派和更多 Adapter 注入；故障测试必须覆盖两个查询族而不能只验证单一路由。
