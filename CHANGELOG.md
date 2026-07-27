# Changelog

## M1-RC1 — Read-Only Governance Release Candidate

状态：Candidate，尚未批准生产发布。

### 已包含

- 五层知识边界、确定性解析与不可变快照；
- 版本化 Registry、PostgreSQL 持久化和 revision CAS；
- 职责分离、审核证据与单数据库 Governance Unit of Work；
- 项目成员、固定角色和默认拒绝授权；
- 五条只读查询路由、OIDC/JWKS RS256 认证与安全 HTTP 边界；
- 可启动只读服务、健康探针、运行事件和优雅关闭；
- 非 Root 容器、Kubernetes 安全基线与故障恢复验收。

### 生产阻断项

- 尚未生成并批准外部镜像仓库 digest；
- 尚未注入真实数据库和 Subject Mapping Secret；
- 尚未在目标 Kubernetes 集群执行 server-side dry-run 与部署验收；
- PR #1～#10 仍需按顺序评审和合并；
- 本阶段不提供任何写入 HTTP API、管理后台或生产执行 Worker。
