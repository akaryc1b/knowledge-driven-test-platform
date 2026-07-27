# M1-H 当前开发交接

## M0 至 M1-G 已完成

- 多项目五层知识模型与确定性快照；
- 版本化 Registry、PostgreSQL 持久化与审计历史；
- 项目治理、职责分离与 revision 绑定审核；
- PostgreSQL 治理证据与单数据库 Unit of Work；
- 只读知识、审核和快照查询边界；
- 持久化项目成员与 deny-by-default 授权；
- 只读 Node HTTP Transport、Bearer 入口、限流和安全响应。

## M1-H 已完成

- 独立 `@kdtp/governance-auth-oidc` package；
- `OidcJwksBearerAuthentication` Authentication Port Adapter；
- 显式 issuer、audience 和 JWKS URI 配置；
- RS256 algorithm allow-list；
- JWT compact serialization、header 和 claims 校验；
- `iss`、`aud`、`sub`、`exp`、`nbf` 和 `iat` 校验；
- clock skew 与可选 maximum token age；
- token header 中的 `jku`、`x5u`、`jwk`、`x5c` 和 `crit` 拒绝；
- HTTPS JWKS 获取、超时和流式响应大小限制；
- bounded Cache-Control max-age；
- 并发刷新去重和未知 kid 的受控刷新；
- JWKS key rotation；
- RSA 2048-bit 最小密钥要求；
- subject 到平台 actor 的映射 Port 与静态适配器；
- fail-closed 401/503 认证语义；
- 认证成功、失败和 JWKS 刷新可观测事件；
- subject fingerprint 与 Token/claims 脱敏；
- 本地签名密钥、模拟 JWKS 和真实临时 JWKS Server 测试。

## 当前边界

- 首版只支持 RS256；
- issuer 和 jwksUri 必须显式配置，不执行 OIDC Discovery；
- 生产 issuer 与 JWKS URI 必须使用 HTTPS；
- `allowHttpForTesting` 只用于本地测试 JWKS Server；
- subject mapper 仍由应用组合根提供；
- 认证事件 Store 当前只有内存示例，事件投递为 best-effort；
- 不处理 Cookie、Session、Refresh Token 或 Token Revocation；
- 不提供 IdP、subject mapping 或成员管理后台；
- 所有写入 HTTP API、k6 Worker、队列和生产执行仍冻结。

## 下一安全切片

`M1-I — Read-Only Service Composition and Operational Controls`

只允许：

- 只读服务应用组合根；
- 显式配置加载与启动校验；
- Registry、治理、成员、查询、HTTP 和 OIDC Adapter 组合；
- liveness、readiness 与依赖探针；
- 结构化运行事件 Port；
- graceful shutdown；
- Dockerfile 与本地只读服务启动示例；
- 不含业务数据的运维端点。

暂不允许：

- 写入 HTTP API；
- 登录页面、Session 或 Refresh Token；
- IdP/成员管理后台；
- AI 自动审核或授权；
- k6 Worker、队列或生产测试执行。
