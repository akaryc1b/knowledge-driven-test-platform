# M1 — Registry and Governance

## 目标

将公司知识从文件输入升级为经过版本化、持久化、项目授权、审核、不可变证据、安全认证、可运维服务和可审查部署治理的可信资产。

## 已完成切片

### M1-A — Knowledge Schema and Registry Boundary

- 版本化 Schema、Registry Port、CAS、生命周期和审计。

### M1-B — Durable Registry Adapter

- PostgreSQL Registry、migration、锁和事务。

### M1-C — Governance Service Boundary

- 项目授权、职责分离、revision 绑定审核和发布策略。

### M1-D — Durable Governance Evidence

- PostgreSQL 审核证据、不可变快照和 Unit of Work。

### M1-E — Read-Only Governance Query API

- 运输无关查询、DTO、过滤、游标和错误 Envelope。

### M1-F — Durable Project Membership and Read Authorization

- 项目目录、成员、角色、PostgreSQL 持久化和默认拒绝授权。

### M1-G — Read-Only HTTP Transport and Authentication Boundary

- Node HTTP、Bearer 入口、请求安全、限流和安全响应头。

### M1-H — OIDC/JWKS Read Authentication Adapter

- RS256、issuer/audience、JWKS cache/rotation、subject mapping 和认证事件。

### M1-I — Read-Only Service Composition and Operational Controls

- 显式应用组合根、migrations、JWKS 预热；
- `/live`、`/ready`、运行事件和优雅关闭；
- 非 Root Dockerfile。

### M1-J — Read-Only Deployment Manifest and Fault Acceptance

详细设计见 [`m1-j-read-only-deployment-fault-acceptance.md`](./m1-j-read-only-deployment-fault-acceptance.md)。

- Kubernetes Deployment、Service、ServiceAccount、ConfigMap 和 PDB；
- Pod Security、资源限额和滚动升级基线；
- Secret 引用契约和示例隔离；
- PostgreSQL/JWKS 故障恢复；
- SIGTERM 和连接排空验收；
- Manifest 与硬化容器 CI。

## 下一安全切片

### M1-K — Read-Only Release Acceptance and Stack Consolidation

- M1 堆叠 PR 顺序复核；
- 真实只读端到端验收；
- 镜像 digest 和部署证据；
- M1 发布候选说明与风险矩阵；
- M1 正式完成条件。

仍不开放写入 HTTP API、自动生产发布、管理后台、Worker、队列或生产测试执行。
