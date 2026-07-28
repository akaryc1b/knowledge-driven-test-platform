# @kdtp/read-only-governance-service

M1-I 建立、M2-H 扩展的统一只读服务组合根。

它负责：

- 显式环境配置与启动校验；
- 单一 PostgreSQL Pool 和四组 checksum migration；
- OIDC/JWKS 预热；
- Knowledge Registry、治理证据、Test Plan Registry、成员授权和两个查询族组合；
- 五条 Knowledge GET 路由与五条 Test Plan GET 路由；
- `/live` 与 `/ready`；
- 结构化、脱敏运行事件；
- 连接跟踪和优雅关闭；
- 非 Root 容器入口。

服务不注入 Planner、计划治理命令或测试执行能力。所有已知业务路由仅允许 GET。
