# M1-E — Read-Only Governance Query API

## 目标

在不开放网络端口和写入接口的前提下，为知识、审核证据和快照建立稳定的只读应用边界。

## 查询能力

- 项目知识列表；
- 项目知识详情；
- Registry 与审核决定时间线；
- 项目快照列表；
- 快照详情。

项目查询默认只返回 `PROJECT` scope 且 `scope.key` 与请求项目一致的知识。其他项目和共享作用域不会通过该边界暴露。

## 身份与授权

Handler 不接收可信 actor 字符串，而是把请求 context 交给 `RequestIdentityContextPort`。Port 解析出 actor 后，查询服务再执行：

- `KNOWLEDGE_READ`；
- `AUDIT_READ`；
- `SNAPSHOT_READ`。

当前内存身份 Adapter 仅用于合同和组合示例，不属于真实登录实现。

## DTO

查询结果不直接返回数据库行或完整 Registry Record：

- Knowledge Summary；
- Knowledge Detail；
- Review Timeline；
- Snapshot Summary；
- Snapshot Detail。

这样可以避免存储字段泄漏并保持后续传输协议稳定。

## 分页

- 默认 25 条；
- 最大 100 条；
- 排序字段白名单；
- cursor 使用 base64url opaque payload；
- cursor 绑定项目、过滤条件、排序字段和方向的 SHA-256 指纹；
- cursor 锚点消失返回 `CURSOR_STALE`；
- cursor 用于不同查询返回 `CURSOR_QUERY_MISMATCH`。

M1-E 不承诺跨持续写入的历史快照分页；需要完全可重复的结果时应查询不可变知识 snapshot。

## 错误 envelope

```json
{
  "status": 404,
  "body": {
    "schemaVersion": "governance-query-response/v1",
    "requestId": "request-001",
    "error": {
      "code": "KNOWLEDGE_NOT_FOUND",
      "message": "Knowledge was not found"
    }
  }
}
```

未知内部错误统一映射为 `QUERY_INTERNAL_ERROR`，不暴露数据库、凭据或堆栈信息。

## 明确不包含

- Express、Fastify 或 Node HTTP Server；
- Bearer Token、OAuth 或 OIDC 验证；
- 写入接口；
- RBAC 管理后台；
- AI 自动审核或发布；
- 测试执行调度。

## 验收标准

- 未认证 credential 返回 401；
- 未授权项目读取返回 403；
- 其他项目和共享知识按不存在处理；
- 列表过滤、排序和分页确定；
- cursor 不能跨查询复用；
- 审核时间线按时间稳定排序；
- 快照查询严格项目隔离；
- 内部错误响应不泄漏原始消息；
- Handler 合同不依赖 HTTP 框架。
