# M2-RC1 Production Promotion

## 目标

本阶段在不改写 M2 合并前候选与合并后验收记录的前提下，追加第三阶段、独立、可审计的生产晋级契约。

Production Promotion Validator 只验证仓库中已经存在的声明，不主动查询或推断 GitHub Actions、GHCR、Secret Provider、目标集群或审批系统状态。外部查询由独立、只读 collector 执行，并把结果固化为可审计证据。

## 不可变前置证据

- `releases/m2/planning-release-candidate.json`
  - canonical SHA-256：`5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697`
- `releases/m2/post-merge-acceptance.json`
  - canonical SHA-256：`d073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25`
- 当前准备晋级的 `main` SHA：`991b5f0f9cfa3a382f9aff3c600f98b76aed9c08`

以上两份历史证据不得被生产晋级记录覆盖或修改。Validator 必须重新读取并计算其 canonical digest。

## Production Promotion 证据域

生产晋级记录必须绑定：

- release ID 与版本；
- 原 M2 candidate digest；
- post-merge acceptance digest；
- 精确 `main` SHA；
- 最终 `main` push CI run 与永久 Artifact digest；
- GHCR 完整不可变镜像引用与 Registry digest；
- SBOM digest；
- provenance 与 SBOM attestation 引用；
- Secret Provider 和仅包含引用的 Secret 记录；
- 目标集群验证记录；
- Change Approval；
- Release Owner Approval；
- resolved/open blockers 与 `productionEligible`。

## 安全默认值

仓库中的 Production Promotion 主记录保持：

- 未通过的外部域为 `UNVERIFIED`、`MISSING`、`NOT_CONFIGURED` 或 `NOT_RUN`；
- 不存在的外部标识和 digest 为 `null`；
- `openBlockers` 保留全部生产阻断项；
- `productionEligible=false`。

失败的 CI 观测通过独立追加证据表达，不把主记录改写成 `PASSED`。不得使用示例 SHA、重复字符 digest、本地 Docker Image ID、占位审批号或可变镜像标签关闭 blocker。

## Blocker 关闭规则

| Blocker | 唯一允许的关闭证据 |
|---|---|
| `main-branch-final-ci-not-verified` | 精确 `main` SHA、真实 push run ID、成功的 Validate/PostgreSQL jobs、成功的 Deployment Validator step，以及该 run 实际生成的 M1/M2/post-merge/PostgreSQL/Repository/Deployment Validation Artifact digest |
| `external-registry-digest-missing` | GHCR `@sha256:` 不可变引用、同值 Registry digest、build run ID、source SHA、SBOM digest、provenance 与 SBOM attestation、digest pull verification |
| `production-secrets-not-configured` | 已允许的 Secret Provider、至少一个版本化 Secret 引用、配置时间；不得包含 Secret 值 |
| `target-cluster-validation-not-run` | 非占位 cluster reference、验证 run ID、source SHA、镜像 digest、deployment manifest digest 与通过时间 |
| `change-approval-missing` | 非占位审批系统、审批号、批准时间 |
| `release-owner-approval-missing` | 非占位审批系统、审批号、批准时间 |

`resolvedBlockers` 必须严格由对应证据推导。`openBlockers` 非空时，`productionEligible` 必须为 `false`；只有六项强制 blocker 全部由证据关闭后才允许为 `true`。

## Main push CI 证据采集

独立 collector 在 GitHub Actions runner 中使用最小 `actions: read` 权限查询 Actions API，并生成 `m2-main-branch-ci-evidence/v1`。

Collector 必须：

- 只选择 `promotionSource.mainSha` 对应的、已完成的 `main` push run；
- 如实记录 run、Validate job、PostgreSQL job 与 Deployment Validator step 的状态和结论；
- 如实记录该历史 run 实际存在的 Artifact，缺失项保持 `null`；
- 只有 run、两个 jobs、Deployment Validator step 与全部强制 Artifact 均成功/存在时才设置 `eligibleForClosure=true`；
- 失败、取消、跳过或缺失证据时仍生成 observation，但固定 `eligibleForClosure=false`；
- 不把 PR run、当前 collector run 或缺失 Artifact 推断成历史 `main` run；
- 不写入 `GITHUB_TOKEN`、请求头或其他认证材料。

## 已确认的最终 main push 结果

只读 collector 已确认精确结果：

- run ID：`30356400001`；
- event：`push`；
- branch：`main`；
- head SHA：`991b5f0f9cfa3a382f9aff3c600f98b76aed9c08`；
- workflow conclusion：`failure`；
- Validate job：`90265505895`，`failure`；
- PostgreSQL job：`90265505920`，`success`；
- Deployment Validator step：`skipped`；
- 唯一实际生成的 Artifact：`postgres-test-log`；
- PostgreSQL Artifact digest：`sha256:ff900fd49517bbc469891017e741d9bcff8b8389b6a9d0881759f42f6a6dbfff`；
- `eligibleForClosure=false`。

失败根因是 Post-Merge evidence generator 在 push 环境中把空字符串 `GITHUB_HEAD_REF` 当成有效分支，导致 `M2 post-merge source branch is invalid`。R0 已增加统一的非空分支归一化和 push 环境回归测试。

因此 `main-branch-final-ci-not-verified` 继续开放。PR Validation、成功的 PostgreSQL job 或此前成功的 M2-I 主分支 run 均不得替代该精确 SHA 的最终成功 push CI。

## 明确不在范围内

- M2-J 或任何 M3 功能；
- Worker、Queue、Scheduler、Kubernetes Job；
- 测试执行、结果采集、Allure、k6/xk6、Playwright；
- 自动生产部署；
- 创建或提交真实 Secret；
- 在未取得真实外部证据时宣布可生产晋级。
