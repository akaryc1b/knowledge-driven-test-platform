# M1-I 当前开发交接

## M0 至 M1-H 已完成

- 多项目五层知识模型与确定性快照；
- 版本化 Registry、PostgreSQL 持久化和审计；
- 职责分离、revision 绑定审核与治理证据；
- 项目成员、固定角色和默认拒绝授权；
- 只读查询 DTO、游标和稳定错误 Envelope；
- Node 只读 HTTP、安全请求边界和限流；
- RS256 OIDC/JWKS、Key Rotation、Subject Mapping 和认证事件。

## M1-I 已完成

- 独立 `@kdtp/read-only-governance-service` 应用；
- 显式环境配置和上下限校验；
- PostgreSQL Pool 创建参数；
- Registry、Governance、Project Access 三组 migration 编排；
- JWKS 启动预热；
- Registry、Evidence、Membership、Query、HTTP 和 OIDC 完整组合；
- `/live` 与 `/ready`；
- PostgreSQL 和 JWKS readiness checks；
- readiness 超时与并发去重；
- 结构化 Runtime Event Port 和 JSON Lines Sink；
- OIDC 事件到运行事件的脱敏桥接；
- Server Socket 跟踪；
- SIGTERM / SIGINT 优雅关闭；
- 启动 readiness 失败自动回收 Server 和 Pool；
- 非 Root Dockerfile 和 Healthcheck；
- Operations JSON Schemas；
- 本地运维启动示例。

## 当前边界

- 业务 HTTP 仍只有五条 GET 路由；
- `/live` 与 `/ready` 不需要认证，但不返回业务或敏感信息；
- Subject Mapping 仍通过启动配置提供；
- 没有 Kubernetes、Helm、生产 Secret 管理或发布流水线；
- 没有 IdP/成员/映射管理 API；
- 没有写入 API、Worker、队列或生产测试执行。

## 下一安全切片

`M1-J — Read-Only Deployment Manifest and Fault Acceptance`

只允许：

- Kubernetes Deployment、Service 和探针配置；
- ConfigMap/Secret 引用契约，不提交真实 Secret；
- Pod Security Context、资源限制和只读文件系统；
- PodDisruptionBudget 与滚动升级基线；
- PostgreSQL/JWKS 故障和恢复验收；
- SIGTERM、连接排空和启动失败验收；
- 容器镜像与 manifest 静态校验。

暂不允许：

- 写入 HTTP API；
- IdP、成员或 Subject Mapping 管理后台；
- 自动生产发布；
- k6 Worker、任务队列或生产测试执行。
