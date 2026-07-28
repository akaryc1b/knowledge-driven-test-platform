# M2-G — Read-Only Plan Query API

## 目标

为 Durable Test Plan Registry 建立项目隔离、传输无关且可通过现有只读 HTTP 安全边界暴露的查询能力。该切片只读取计划、Coverage、Provenance 和治理审计证据，不创建、修改、审核、批准或冻结计划。

## 五条只读路由

```text
GET /v1/projects/{projectId}/test-plans
GET /v1/projects/{projectId}/test-plans/{planId}
GET /v1/projects/{projectId}/test-plans/{planId}/coverage
GET /v1/projects/{projectId}/test-plans/{planId}/provenance
GET /v1/projects/{projectId}/test-plans/{planId}/timeline
```

已知路由只接受 GET；其他方法返回 405 和 `Allow: GET`。不存在 POST、PUT、PATCH 或 DELETE 计划路由。

## 查询边界

新增：

```text
packages/test-plan-query/
packages/test-plan-http/
```

`test-plan-query` 提供运输无关 Handler、DTO、过滤、排序和 cursor；`test-plan-http` 复用 M1 的 Bearer 提取、OIDC AuthenticationPort、限流、Request ID、安全 Header 和错误脱敏规则，不复制认证实现。

## 身份与授权

- list、detail、coverage、provenance 使用 `PLAN_READ`；
- timeline 使用 `PLAN_AUDIT_READ`；
- actor 只能由认证后的 Request Identity Context 构造；
- 项目成员授权默认拒绝；
- 未授权项目返回 403；
- 已授权项目中不存在或属于其他项目的计划按不存在处理；
- 原始 Token、Subject Mapping 和数据库连接信息不得进入 DTO、日志或错误。

## DTO

只返回稳定 DTO：

- Test Plan Summary；
- Test Plan Detail；
- Coverage View；
- Provenance View；
- Plan Audit Timeline。

Detail 可以暴露执行器无关 Intent、Dependency DAG、Snapshot ID/digest、Capability Catalog version/digest、计划 digest、状态和 revision，但不得返回数据库行、input fingerprint、凭证、脚本或私钥材料。

## 列表、过滤与分页

- 默认 25 条，最大 100 条；
- 支持状态、Snapshot ID 和 Capability Catalog version 精确过滤；
- 排序字段使用白名单；
- 默认按 `createdAt DESC, planId ASC` 稳定排序；
- cursor 为 base64url opaque payload；
- cursor 绑定项目、过滤、排序和方向的 SHA-256 指纹；
- cursor 锚点消失返回 `CURSOR_STALE`；
- cursor 跨查询复用返回 `CURSOR_QUERY_MISMATCH`。

## 错误与安全

响应使用 `test-plan-query-response/v1` envelope。未知内部错误统一映射为 `PLAN_QUERY_INTERNAL_ERROR`，不暴露 SQL、堆栈、Token 或连接串。

HTTP 入口继续执行：

- URL、Header、Accept、Query 参数和 Request Body 上限；
- 重复参数和编码斜杠拒绝；
- 认证前限流；
- `Cache-Control: no-store` 与完整安全 Header；
- 401、403、404、405、429 和 5xx 稳定映射。

## 验收标准

- 五条查询路由合同通过；
- 未认证返回 401，未授权项目返回 403；
- 跨项目计划不泄漏；
- 列表过滤、排序和 cursor 确定；
- Coverage、Provenance 和 timeline 与 Registry 中当前计划 revision 精确一致；
- FROZEN 与非 FROZEN 计划均只能只读；
- 所有写方法被拒绝；
- 错误和运行事件不包含敏感信息；
- M1 与 M2-A～M2-F 全量回归继续通过。

## 明确不包含

- 任何计划写入 HTTP API；
- Planner 或治理命令的远程调用；
- k6、xk6、Playwright、Worker、Queue、Scheduler、Kubernetes Job；
- 测试执行、结果采集、Allure 或 M3。
