# M2 Release Readiness and Historical Promotion Acceptance Matrix

## A. 不可变发布证据

| ID | 控制 | 自动验证 | 当前状态 |
|---|---|---|---|
| RR-01 | Candidate 与 Post-merge 不可变 | canonical SHA-256 | 通过 |
| RR-02 | 精确 main-push CI | Run、Job、Artifact 与 SHA | 通过 |
| RR-03 | GHCR 不可变镜像 | 完整 `@sha256:` 引用 | 通过 |
| RR-04 | SBOM 与 Attestation | ID、format、bundle digest | 通过 |
| RR-05 | Deployment digest binding | Manifest 与镜像证据交叉校验 | 通过 |
| RR-06 | 非 Root 与 hardened runtime | Docker runtime gate | 通过 |
| RR-07 | 历史失败证据保留 | 追加式观察 | 通过 |

## B. 可移植部署合同

| ID | 控制 | 自动验证 | 当前状态 |
|---|---|---|---|
| PR-01 | Repository 与 Environment 决策分离 | 独立字段 | 通过 |
| PR-02 | 环境资格不得猜测 | `environmentPromotionEligible=null` | 通过 |
| PR-03 | Repository blocker | `repositoryBlockers=[]` | 通过 |
| PR-04 | Operator-supplied runtime config | 服务 required env 交叉校验 | 通过 |
| PR-05 | Provider agnostic | Deployment 无特定 Provider 集成 | 通过 |
| PR-06 | Secret 值禁止入库 | 敏感扫描与 ConfigMap 边界 | 通过 |
| PR-07 | 部署方责任 | Runtime、环境验证和本地治理 | 通过 |

## C. 历史 Production Promotion 定位

`releases/m2/production-promotion.json` 继续保留历史 `productionEligible=false` 和四个环境 blocker。这些字段不得篡改，但不进入仓库级发布决策。

## D. 部署方 Gates

1. `runtime-configuration-supplied`；
2. `environment-placeholders-replaced`；
3. `target-environment-validated`；
4. `local-governance-completed-if-required`。

## E. M2-RC1 Final Release Closure

| ID | 控制 | 自动验证 | 关闭条件 |
|---|---|---|---|
| FC-01 | 精确关闭基线 | PR #38 Head 与 Merge SHA | 固定匹配 |
| FC-02 | General main-push | Run `30523601698` 与两个 Job | success |
| FC-03 | Portable main-push | Run `30523600767` 与两个 Job | success |
| FC-04 | Historical R2-A main-push | Run `30523600763` 与两个 Job | success |
| FC-05 | Read-only observation | Run `30524112914`、Artifact `8751973494` | success、未过期 |
| FC-06 | 历史 digest | Promotion、R2-A、R1-B、Deployment | 精确匹配 |
| FC-07 | M2 关闭决策 | `m2Rc1Closed=true` | true |
| FC-08 | M3 入口 | `m3PlanningReady=true` | true |
| FC-09 | 禁止提前实现 | `m3ImplementationStarted=false` | false |
| FC-10 | 安全边界 | Secret、Cluster、Approval、Rollout、Execution 均未发生 | 全部 false |

## 当前决策

```text
m2Rc1Closed=true
repositoryReleaseReady=true
environmentPromotionEvaluated=false
environmentPromotionEligible=null
m3PlanningReady=true
m3ImplementationStarted=false
repositoryBlockers=[]
```
