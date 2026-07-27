# M1-J 当前开发交接

## M0 至 M1-I 已完成

- 多项目五层知识模型与确定性快照；
- Registry、治理证据、项目成员的 PostgreSQL 持久化；
- 职责分离、revision 绑定审核与默认拒绝授权；
- 只读 Query、HTTP、OIDC/JWKS 和完整应用组合；
- `/live`、`/ready`、运行事件、连接跟踪和优雅关闭；
- 非 Root Docker 镜像基线。

## M1-J 已完成

- Kubernetes ServiceAccount；
- 非敏感 ConfigMap；
- Secret 键契约与非生产示例；
- 两副本 Deployment；
- ClusterIP Service；
- PodDisruptionBudget；
- RollingUpdate `maxUnavailable=0`；
- Startup、Liveness 与 Readiness Probe；
- 非 Root、RuntimeDefault seccomp、只读根文件系统；
- Drop ALL、禁止提权和禁止 ServiceAccount Token 自动挂载；
- CPU/内存 requests 与 limits；
- 有界 `/tmp` volume；
- JSON-compatible YAML 确定性校验器；
- Deployment Fault Acceptance Schema 与示例；
- PostgreSQL 故障/恢复验收；
- JWKS 故障/恢复验收；
- Liveness 与 Readiness 分离验收；
- SIGTERM 活动请求排空验收；
- Docker 硬化运行参数 CI。

## 当前边界

- Manifest 是部署基线，不是生产发布授权；
- 示例镜像标签必须在生产晋级时替换为 digest；
- 示例 OIDC 地址必须由环境覆盖；
- 示例 Secret 不会被默认 Kustomization 应用；
- 未提供 Ingress、Gateway、NetworkPolicy 或 Helm；
- 未接入云 Secret Manager；
- 没有写入 API、管理后台、Worker、队列或生产测试执行。

## 下一安全切片

`M1-K — Read-Only Release Acceptance and Stack Consolidation`

只允许：

- M1-A 至 M1-J 堆叠 PR 的顺序复核与合并准备；
- 真实 PostgreSQL + 本地 JWKS + HTTP 只读端到端验收；
- 镜像 digest 与部署证据模型；
- 版本、变更记录和 M1 发布候选说明；
- 安全、故障和可观测性验收矩阵；
- M1 正式完成条件与未决风险。

暂不允许：

- 写入 HTTP API；
- 自动生产发布；
- IdP、成员或 Subject Mapping 管理后台；
- k6 Worker、任务队列或生产测试执行；
- 启动 M2 功能开发。
