# M1-G — Read-Only HTTP Transport and Authentication Boundary

## 目标

在保持所有写入能力冻结的前提下，为 M1-E 只读查询 Handler 增加受控 Node HTTP 入口，并在进入业务查询前完成凭证提取、认证、限流和运输层安全校验。

## 只读路由

仅允许以下 GET 路由：

```text
GET /v1/projects/{projectId}/knowledge
GET /v1/projects/{projectId}/knowledge/{id}/versions/{version}
GET /v1/projects/{projectId}/knowledge/{id}/versions/{version}/timeline
GET /v1/projects/{projectId}/snapshots
GET /v1/projects/{projectId}/snapshots/{snapshotId}
```

已知路由使用其他方法返回 405 和 `Allow: GET`。未知路由返回 404。不存在 POST、PUT、PATCH 或 DELETE 业务路由。

## 认证链路

```text
Authorization: Bearer <opaque credential>
                ↓
Credential 提取和长度限制
                ↓
AuthenticationPort.authenticate
                ↓
{ actor, attributes }
                ↓
AuthenticatedRequestIdentityContext
                ↓
M1-E Query Handler
                ↓
M1-F Membership Authorization
```

Transport 不把原始 Bearer Token 传入查询服务，也不在错误、限流键或日志模型中保存 Token。内存认证 Adapter 仅用于测试和示例。

## 请求安全

- 请求 URL 最大长度受控；
- 路由和查询参数使用白名单；
- 重复查询参数被拒绝；
- 路径编码错误和编码斜杠被拒绝；
- `Accept` 仅允许 JSON 兼容媒体范围且 `q > 0`；
- 默认请求体上限为 0 字节；
- 即使配置了更高上限，只读路由仍不接受非空请求体；
- 请求 Header 名称和值执行基础语法校验；
- `x-request-id` 必须满足平台 Request ID 约束，否则自动生成 UUID Request ID。

## 限流

`ReadOnlyRateLimitPort` 在认证前消费请求。默认限流键为：

```text
remoteAddress + SHA-256(bearer credential)
```

这样可以限制未知凭证的认证尝试，同时避免在限流存储中保存原始 Token。内存 fixed-window Adapter 仅用于单进程测试与示例。

## 响应安全

所有响应包含：

- `Cache-Control: no-store`；
- `Content-Type: application/json; charset=utf-8`；
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`；
- `Cross-Origin-Resource-Policy: same-origin`；
- `Permissions-Policy`；
- `Referrer-Policy: no-referrer`；
- `X-Content-Type-Options: nosniff`；
- `X-Frame-Options: DENY`；
- `X-Request-ID`；
- `Vary: Accept, Authorization`。

默认不添加 CORS 头。401 返回 `WWW-Authenticate: Bearer`，405 返回 `Allow: GET`，429 返回 RateLimit 和 Retry-After 头。

## 错误策略

运输层错误继续使用 `governance-query-response/v1` JSON Envelope。所有 5xx 错误统一映射为：

```json
{
  "error": {
    "code": "HTTP_INTERNAL_ERROR",
    "message": "The read-only HTTP request could not be completed"
  }
}
```

底层异常消息、Token、数据库错误和认证后端细节不得泄漏。

## Node Adapter

提供：

- `ReadOnlyGovernanceHttpTransport.dispatch`：HTTP 语义但不依赖 Socket；
- `createReadOnlyNodeHttpHandler`：适配 Node IncomingMessage/ServerResponse；
- `createReadOnlyNodeHttpServer`：创建未监听的 Node Server。

应用组合根负责监听地址、TLS、真实认证 Adapter 和优雅关闭。

## 验收标准

- 五条只读路由全部可达；
- 所有写方法被拒绝；
- Bearer 缺失、格式错误、未知、停用和过期均返回 401；
- 请求体、无效 Accept、无效 URL 和重复参数被拒绝；
- 请求 ID 在成功和流式错误响应中均可追踪；
- Token 不出现在响应和限流键明文中；
- 限流超限返回 429；
- 所有 5xx 错误脱敏；
- 安全响应头完整；
- 真实临时 Node Server 合同测试通过；
- M1-A 至 M1-F 全部回归继续通过。
