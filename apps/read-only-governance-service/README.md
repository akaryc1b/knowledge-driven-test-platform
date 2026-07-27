# @kdtp/read-only-governance-service

M1-I 的只读服务组合根。

它负责：

- 显式环境配置与启动校验；
- PostgreSQL Pool 和三组 migration；
- OIDC/JWKS 预热；
- Registry、治理证据、成员授权、查询和 HTTP 组合；
- `/live` 与 `/ready`；
- 结构化运行事件；
- 连接跟踪和优雅关闭；
- 非 Root 容器入口。

业务端仍只有 M1-G 定义的五条 GET 路由。
