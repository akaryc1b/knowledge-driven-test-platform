# M2-H — Planning Service Composition and Operations

## 目标

将 M2-G 的五条 Test Plan 只读路由接入现有 `read-only-governance-service`，形成单进程、单端口、单 PostgreSQL Pool、统一 OIDC/JWKS 与项目成员授权的十路由只读服务。该切片只扩展查询组合和运维验收，不提供计划写操作或测试执行。

## 服务表面

服务同时提供：

```text
Knowledge read routes: 5
Test Plan read routes: 5
Operational routes: /live, /ready
```

所有业务路由继续只允许 GET。已知路由上的 POST、PUT、PATCH 和 DELETE 必须返回 405；不存在远程 generate、submit、review、approve 或 freeze。

## 组合要求

- `apps/read-only-governance-service` 显式组合 `test-plan-postgres`、`test-plan-query` 和 `test-plan-http`；
- Knowledge 与 Test Plan Route Matcher 决定唯一业务 Transport；
- 两类 Transport 共享同一个 AuthenticationPort、Subject Mapper、JWKS Provider、RateLimiter、clock 和 Request ID 工厂；
- 两类查询共享同一个 PostgreSQL Pool 和项目成员授权 Adapter；
- Test Plan DTO 不复用数据库行，不暴露 input fingerprint；
- 未匹配业务路由仍由既有稳定 404 语义处理；
- Operational handler 在业务 handler 外层保持 `/live`、`/ready`、安全 Header 和 no-store。

## 启动顺序

```text
load and validate config
  ↓
create PostgreSQL Pool
  ↓
apply Knowledge Registry migrations
  ↓
apply Knowledge Governance migrations
  ↓
apply Project Membership migrations
  ↓
apply Test Plan Registry migrations
  ↓
warm JWKS
  ↓
construct ten-route read-only service
  ↓
listen
  ↓
startup readiness
```

任一 migration 或 JWKS warm-up 失败时不得监听端口。

## Readiness 与故障恢复

`/ready` 必须同时检查：

- PostgreSQL Pool 可执行有界查询；
- JWKS Provider 可提供当前可用 key set；
- 服务已启动且未进入 stopping。

验收包含：

- PostgreSQL 中断后 `/live` 仍为 200、`/ready` 为 503；
- PostgreSQL 恢复后同一进程 `/ready` 返回 200；
- JWKS 无可用缓存时 readiness 失败；
- 有效 stale-if-error key 仍按既有 OIDC 合同处理；
- migration 失败回滚且不监听；
- SIGTERM/SIGINT 有界停止并关闭 Pool；
- 运行事件不记录 Token、数据库 URL、私钥或原始 Subject Mapping。

## 真实 E2E

使用真实 PostgreSQL 18、临时 JWKS HTTP Server、RS256 JWT 和持久化 Project Membership，证明：

1. 同一 Bearer Token 可以访问授权项目的 Knowledge 与 Test Plan 路由；
2. 未认证请求返回 401；
3. 未授权项目返回 403；
4. 跨项目 Knowledge 与 Test Plan 记录不泄漏；
5. Test Plan coverage、provenance 与 timeline 可从 PostgreSQL 重载；
6. 十条业务路由均为只读；
7. 数据库故障与恢复无需重启进程。

## 配置与部署

继续使用单一 `KDTP_DATABASE_URL`，不新增第二数据库连接串。Kubernetes Service、ServiceAccount、PDB、SecurityContext 和非 root 镜像基线保持不变；文档和示例配置只说明新增 Test Plan migration/query 能力。

## 验收标准

- 十条业务路由通过真实 Node HTTP 合同测试；
- 四组 migration 严格按顺序执行；
- 两类查询复用同一认证、限流、身份和授权对象；
- 真实 PostgreSQL/JWKS/JWT/Membership E2E 通过；
- PostgreSQL outage/recovery、JWKS fault、graceful shutdown 通过；
- Node、PostgreSQL、部署、M1 Release 与 Docker 硬化回归通过；
- M2-I 前不生成 M2 Release Candidate。

## 明确不包含

- 任何计划或知识写入 HTTP API；
- 执行器、Worker、Queue、Scheduler 或 Kubernetes Job；
- k6/xk6、Playwright、测试执行、结果采集或 Allure；
- M3。
