# ADR-0010：认证完成后才构造查询身份

- 状态：Accepted
- 日期：2026-07-27

## 背景

M1-E Query Handler 通过 Request Identity Context Port 获得 actor，但没有网络入口，也不验证原始凭证。若 HTTP Adapter 直接把 Bearer Token 作为查询 context 传入，会把运输层秘密扩散到业务层，并使测试难以证明认证顺序和 Token 不泄漏。

## 决策

1. HTTP Transport 单独定义 `AuthenticationPort`；
2. 原始 Bearer Credential 只存在于 HTTP 与 Authentication Adapter 边界；
3. Authentication Port 返回最小身份 `{ actor, attributes }`；
4. Transport 通过 `AuthenticatedRequestIdentityContext` 把已认证身份交给 M1-E Handler；
5. Query Handler 和 Membership Authorization 不接收原始 Token；
6. 限流键只使用 Token 的 SHA-256 指纹；
7. 所有 5xx 运输层错误统一脱敏；
8. InMemory Bearer Adapter 明确标记为测试/示例实现。

## 结果

优点：

- Token 不进入查询或授权领域；
- 认证与项目授权职责清晰；
- 可替换 OIDC、JWT、API Gateway 或内部认证实现；
- HTTP 合同可以独立测试；
- 降低凭证在错误和日志中泄漏的风险。

代价：

- 应用组合需要同时装配 Authentication、Query Handler 和 Membership Authorization；
- 真实 JWT/JWKS 验证仍需后续 Adapter；
- 运输层需要维护独立的限流和错误策略。
