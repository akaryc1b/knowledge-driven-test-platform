# M2 Release Readiness and Historical Promotion Acceptance Matrix

## A. 不可变发布证据

| ID | 控制 | 自动验证 | 当前状态 |
|---|---|---|---|
| RR-01 | Candidate 不可变 | canonical SHA-256 | 通过 |
| RR-02 | Post-merge acceptance 不可变 | canonical SHA-256 | 通过 |
| RR-03 | 精确发布源 | 固定 `main` source SHA | 通过：`6bef789d...` |
| RR-04 | 精确 main-push CI | Run、Job、Artifact 与 source SHA | 通过 |
| RR-05 | GHCR 不可变镜像 | 完整 `@sha256:` 引用 | 通过 |
| RR-06 | Registry pull verification | resolved digest 精确匹配 | 通过 |
| RR-07 | SBOM | SPDX JSON digest | 通过 |
| RR-08 | Provenance Attestation | ID 与 bundle digest | 通过 |
| RR-09 | SBOM Attestation | ID 与 bundle digest | 通过 |
| RR-10 | Deployment digest binding | Manifest 与镜像证据交叉校验 | 通过 |
| RR-11 | 非 Root 与 hardened runtime | Docker runtime gate | 通过 |
| RR-12 | 历史失败证据保留 | 追加式观察，不覆盖旧 Run | 通过 |

## B. 可移植部署合同

| ID | 控制 | 自动验证 | 关闭条件 |
|---|---|---|---|
| PR-01 | 仓库级发布与环境晋级分离 | `repositoryReleaseReady` 与 `environmentPromotionEvaluated` 独立 | `true / false` |
| PR-02 | 环境资格不得由仓库猜测 | `environmentPromotionEligible=null` | 必须为 `null` |
| PR-03 | Repository blocker | 确定性空数组 | `repositoryBlockers=[]` |
| PR-04 | Operator-supplied runtime config | 服务 required env 与合同交叉校验 | 五项输入完整 |
| PR-05 | Provider agnostic | Deployment 不含 Provider-specific 集成 | `providerAgnostic=true` |
| PR-06 | Provider metadata 非必需 | 合同明确禁止仓库强制 Provider 记录 | `repositoryRequiresProviderMetadata=false` |
| PR-07 | Secret 值禁止入库 | 敏感模式扫描与 ConfigMap 边界 | `repositoryStoresSecretValues=false` |
| PR-08 | 数据库配置边界 | `KDTP_DATABASE_URL` 不在 ConfigMap | 仅由部署方注入 |
| PR-09 | OIDC 配置边界 | Issuer/JWKS/Audience 与服务配置交叉校验 | 模板字段存在 |
| PR-10 | Subject Mapping 边界 | 不写入基础 ConfigMap | 部署方受控注入 |
| PR-11 | 显式占位配置 | `.invalid` OIDC 模板 | 部署前必须替换 |
| PR-12 | 通用 Secret 引用 | Deployment 仅引用稳定 Kubernetes Secret 名称 | 不规定来源 |
| PR-13 | Secret 不进入 Kustomization | Resource 列表无 Secret Manifest | 通过 |
| PR-14 | 部署方责任 | Runtime、环境验证、本地治理独立列出 | 完整且顺序固定 |
| PR-15 | 历史 Promotion 不篡改 | canonical digest 精确匹配 | 通过 |
| PR-16 | 历史 R2-A Intake 不篡改 | 四项仍为 `NOT_PROVIDED` | 通过 |
| PR-17 | 永久 CI | General + Dedicated + PG18 + Docker + Artifact | 全部成功 |

## C. 历史 Production Promotion 的定位

`releases/m2/production-promotion.json` 继续作为历史环境晋级模型保留，当前状态仍为：

- `productionEligible=false`
- `production-secrets-not-configured`
- `target-cluster-validation-not-run`
- `change-approval-missing`
- `release-owner-approval-missing`

这些字段不能删除或伪造关闭，因为它们是已发布历史证据的一部分。

但它们不再进入仓库级 `repositoryBlockers`，也不影响 `repositoryReleaseReady`。

## D. 部署方 Gates

某个组织实际部署时自行完成：

1. `runtime-configuration-supplied`
2. `environment-placeholders-replaced`
3. `target-environment-validated`
4. `local-governance-completed-if-required`

这些 Gate 属于部署实例，不属于通用产品仓库。

## 当前决策

```text
repositoryReleaseReady=true
environmentPromotionEvaluated=false
environmentPromotionEligible=null
repositoryBlockers=[]
```
