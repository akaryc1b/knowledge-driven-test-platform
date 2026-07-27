# @kdtp/governance-http

M1-G 的只读 Node HTTP 与认证边界。

能力：

- Bearer Credential 提取；
- Authentication Port；
- 请求 ID；
- 安全响应头；
- 只读限流 Port；
- GET 路由白名单；
- 查询参数白名单；
- 请求体大小限制；
- Node `http` Adapter；
- 稳定 JSON 错误响应。

该包不提供写入路由，不实现 OAuth/OIDC，不启动长期运行的生产服务。
