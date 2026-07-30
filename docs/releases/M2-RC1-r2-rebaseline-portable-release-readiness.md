# M2-RC1 R2-Rebaseline — Portable Release Readiness

## 决策

R2-Rebaseline 将 M2-RC1 的权威仓库级结论从“特定生产环境已晋级”调整为“版本具备可移植、安全部署条件”。

新的权威结论：

- `repositoryReleaseReady=true`
- `environmentPromotionEvaluated=false`
- `environmentPromotionEligible=null`
- `repositoryBlockers=[]`

这不是降低安全要求，而是将责任放回正确边界：

- 仓库负责代码、镜像、SBOM、Attestation、Deployment 模板和配置合同；
- 部署方负责自己的 Secret 交付、目标环境验证和本地审批制度。

## 为什么需要 Rebaseline

旧 R2-B～R2-E 假设仓库直接管理一个固定生产环境，因此要求：

- 真实 Secret Provider 与版本引用；
- 真实 Kubernetes Cluster ID；
- Change Approval；
- Release Owner Approval。

本项目是可被不同组织部署的平台，不应要求产品仓库持有每个部署方的云资源标识、Secret Provider 元数据或审批编号。

## 保留的历史证据

R2-Rebaseline 不修改：

- `releases/m2/production-promotion.json`
- `releases/m2/r2a-external-evidence-intake.json`
- `releases/m2/r1b-image-binding.json`
- `releases/m2/release-image-evidence.json`
- 不可变 Deployment image digest

固定 digest：

- Historical Production Promotion：
  `sha256:4125d5f08ec559e2bc6012ab501879432493af012b4d70665eb1d653c4190f5d`
- R2-A Intake：
  `sha256:54413977a3030847fdef7e3aa77c2a1c2924677f0555a4fabdba888f829a6d18`
- R1-B Binding：
  `sha256:adb6374bee157b7b64d25b6fdfe1b35ea2d4e5e92a08b029c0fbc5e66c33c0a7`
- Deployment：
  `sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45`

## 新合同

新增：

- `m2-portable-release-readiness/v1`
- `m2-portable-release-readiness-evidence/v1`
- `releases/m2/portable-release-readiness.json`
- 确定性 Validator；
- Runtime Configuration 与 Deployment 模板交叉校验；
- Dedicated PR/main-push Workflow；
- Node、PostgreSQL 18、四个 PostgreSQL examples 和 Docker hardened runtime；
- 90 天永久 Artifact。

## Runtime Configuration

必须由部署方提供：

| 变量 | 分类 | 仓库是否允许真实值 |
|---|---|---|
| `KDTP_DATABASE_URL` | 敏感或身份绑定配置 | 否 |
| `KDTP_OIDC_ISSUER` | 非敏感配置 | 允许模板，生产值由 Overlay 替换 |
| `KDTP_OIDC_JWKS_URI` | 非敏感配置 | 允许模板，生产值由 Overlay 替换 |
| `KDTP_OIDC_AUDIENCE` | 非敏感配置 | 是 |
| `KDTP_OIDC_SUBJECT_MAPPINGS_JSON` | 安全配置 | 否 |

数据库身份交付可以使用：

- Kubernetes Secret；
- External Secret Provider；
- Workload Identity Adapter；
- 部署组织批准的其他安全注入方式。

仓库不要求 Provider 名称、外部 Secret 路径、版本 ID 或审计事件 ID。

## 安全边界

本切片不：

- 获取 Secret；
- 创建 Secret；
- 访问目标集群；
- 执行 server-side apply 或 dry-run；
- 创建审批；
- 执行 rollout；
- 发布新镜像；
- 修改不可变 digest；
- 声明任意具体环境已晋级。

## 后续

R2-B～R2-E 不再作为仓库开发切片继续。

需要部署实例验收的组织可以使用保留的 R2-A Schema，或将其映射到自己的平台工程和变更治理体系。
