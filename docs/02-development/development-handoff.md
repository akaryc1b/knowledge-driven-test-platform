# M1-G 当前开发交接

## M0 至 M1-F 已完成

- 多项目五层知识模型与确定性快照；
- 版本化 Registry、PostgreSQL 持久化与审计历史；
- 项目治理、职责分离与 revision 绑定审核；
- PostgreSQL 治理证据与单数据库 Unit of Work；
- 只读知识、审核和快照查询边界；
- 持久化项目目录、成员关系和 deny-by-default 授权。

## M1-G 已完成

- 独立 `@kdtp/governance-http` package；
- Node `http` 只读 Transport Adapter；
- 五条 GET 路由白名单；
- Bearer Credential 提取；
- Authentication Port；
- 认证结果到 Request Identity Context 的可信桥接；
- 请求 ID 透传与生成；
- JSON 内容协商；
- 查询参数白名单和重复参数拒绝；
- URL 长度限制；
- 只读请求体拒绝与流式大小限制；
- 只读限流 Port 与内存 fixed-window Adapter；
- 凭证指纹限流键，不保存原始 Token；
- 安全响应头；
- 401、404、405、406、413、429 与 500 稳定映射；
- 所有 5xx 响应脱敏；
- 真实临时 Node Server 合同测试。

## 当前边界

- HTTP Transport 只开放 GET，不存在写入路由；
- InMemory Bearer Authentication 只用于测试与示例，不属于生产 Token 验证器；
- 未接入 OAuth/OIDC、JWKS、SAML 或 Session；
- 默认不发送 CORS 响应头；
- 默认拒绝任何请求体；
- Server Factory 不自动监听固定端口；
- 项目读取权限仍由 M1-F Membership Authorization 决定；
- 没有管理后台、生产 Worker、队列或生产测试执行。

## 下一安全切片

`M1-H — OIDC/JWKS Read Authentication Adapter`

只允许：

- JWT Bearer 验证 Port Adapter；
- issuer、audience、algorithm 与时钟偏差校验；
- JWKS 获取、缓存、刷新和 key rotation；
- subject 到平台 actor 的映射 Port；
- fail-closed 认证错误；
- 认证可观测事件；
- 测试用本地签名密钥和 HTTP-free 合同测试。

暂不允许：

- 写入 HTTP API；
- IdP 管理后台；
- 登录页面、Cookie Session 或 Refresh Token；
- 成员管理 API；
- AI 自动审核或授权；
- k6 Worker、队列或生产执行。
