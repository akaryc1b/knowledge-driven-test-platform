# M2 Production Promotion Acceptance Matrix

| ID | 控制 | 自动验证 | 当前状态 | 关闭条件 |
|---|---|---|---|---|
| PP-01 | 历史 candidate 不可变 | 重新计算 canonical SHA-256 | 通过 | digest 精确等于固定值 |
| PP-02 | post-merge acceptance 不可变 | 重新计算 canonical SHA-256 | 通过 | digest 精确等于固定值 |
| PP-03 | 精确晋级源 | 40 位 Git SHA 与固定 `main` SHA | 通过：`6bef789d...` | `promotionSource.mainSha` 精确匹配 |
| PP-04 | 最终 `main` push CI | exact run/source、Validate/PostgreSQL jobs、Deployment step、六类 Artifact digest | 通过：run `30440545497` | 所有字段完整、成功且不含占位值 |
| PP-05 | GHCR 不可变镜像 | `@sha256:` 引用与 Registry digest 同值 | 通过 | build/pull/SBOM/Attestation 证据完整 |
| PP-06 | 本地 Image ID 禁止冒充 | 拒绝 mutable tag 与 `docker-image://` | 通过 | 仅接受完整 Registry digest 引用 |
| PP-07 | SBOM | SPDX/CycloneDX 文件 digest | 通过：SPDX JSON | `sha256:<64 hex>` 且由发布 Workflow 生成 |
| PP-08 | Provenance | GitHub Artifact Attestation 标识与 bundle digest | 通过：ID `37705043` | provenance attestation 完整 |
| PP-09 | SBOM Attestation | GitHub Artifact Attestation 标识与 bundle digest | 通过：ID `37705058` | SBOM attestation 完整 |
| PP-10 | Secret 引用治理 | Provider allow-list、版本化引用、敏感扫描 | 未配置 | 不含值，仅含引用 |
| PP-11 | 目标集群验证 | cluster ref、run、source/image/manifest digest | 未运行 | 全部字段完整且通过 |
| PP-12 | Change Approval | system、approval ID、approvedAt | 缺失 | 非占位且状态为 `APPROVED` |
| PP-13 | Release Owner Approval | system、approval ID、approvedAt | 缺失 | 非占位且状态为 `APPROVED` |
| PP-14 | Blocker 推导 | 由六个证据域确定性计算 | 通过 | resolved/open 不重叠且顺序固定 |
| PP-15 | Production eligibility | 决策一致性 | `false` | open blockers 为空时才允许 `true` |
| PP-16 | 敏感信息禁止 | canonical JSON 扫描 | 通过 | 无 token、密码、私钥、连接串、subject mapping、kubeconfig |
| PP-17 | 占位证据禁止 | exact ID/digest 与 repeated-hex 检测 | 通过 | 关闭证据不可为示例或伪造格式 |
| PP-18 | Production Promotion Artifact | 独立 evidence generator 与 CI upload | 通过 | Artifact 成功生成且无敏感信息 |
| PP-19 | 历史失败 run 保留 | `main-branch-ci-observation.json` 防篡改 Validator | 通过 | 失败 run `30356400001` 不被覆盖或改写 |
| PP-20 | R0 main-CI closure | `r0-main-ci-closure.json` 精确 run/job/step/artifact Validator | 通过 | 原 run `30423781549` 继续保留 |
| PP-21 | R1-B release evidence | release Workflow、Artifact ID/digest 与仓库证据副本交叉校验 | 通过：run `30440674461` | release evidence canonical digest 精确匹配 |
| PP-22 | Deployment digest binding | Deployment image 与发布不可变引用完全相同 | 通过 | manifest canonical digest 与 binding 一致 |
| PP-23 | R1-B 不越权 | Secret、cluster、approval 仍缺失且 `productionEligible=false` | 通过 | 四项外部 blocker 继续开放 |
| PP-24 | R2-A 输入状态模型 | 四态枚举与状态/载荷/验证元数据组合校验 | 通过 | 仅接受 `NOT_PROVIDED`、`PROVIDED_UNVERIFIED`、`VERIFIED`、`REJECTED` |
| PP-25 | R2-A 输入绑定 | contract base、release source、image 与 Deployment digest 交叉校验 | 通过 | 与 R1-B 真实证据精确一致 |
| PP-26 | R2-A 外部 ID 与时间 | external record ID equality、canonical UTC 与时间顺序 | 通过 | ID 一致且 `verifiedAt >= providedAt` |
| PP-27 | R2-A Secret Provider contract | 既有五项 allow-list 与 Provider-specific versioned reference | 通过 | 不含值且禁止 `latest` |
| PP-28 | R2-A fail closed | 未验证或拒绝输入不允许修改 Promotion | 通过 | `promotionMutationAllowed=false` 且四项输入均 `NOT_PROVIDED` |
| PP-29 | R2-A 永久门禁 | 通用和独立 PR/main-push Workflow、Node/PG18/Docker/Artifact | 待 PR CI | 全部 Jobs 成功且 Artifact 永久记录 |

## R2-A 状态语义

1. `NOT_PROVIDED`：没有外部证据，blocker 保持开放。
2. `PROVIDED_UNVERIFIED`：格式正确但没有真实外部验证，blocker 保持开放。
3. `VERIFIED`：外部来源、ID、时间和绑定全部通过；仅允许后续对应安全切片据此推导 blocker。
4. `REJECTED`：输入无效或验证失败，blocker 保持开放。

R2-A 本身不得基于 `VERIFIED` 测试夹具改写 Production Promotion。仓库持久记录必须全部为 `NOT_PROVIDED`。

## 强制 Blocker 顺序

1. `main-branch-final-ci-not-verified`
2. `external-registry-digest-missing`
3. `production-secrets-not-configured`
4. `target-cluster-validation-not-run`
5. `change-approval-missing`
6. `release-owner-approval-missing`

Validator 必须按照上述顺序推导 `resolvedBlockers` 和 `openBlockers`，不得由提交者任意声明。

## 当前决策

`resolvedBlockers`：

1. `main-branch-final-ci-not-verified`
2. `external-registry-digest-missing`

`openBlockers`：

1. `production-secrets-not-configured`
2. `target-cluster-validation-not-run`
3. `change-approval-missing`
4. `release-owner-approval-missing`

`productionEligible=false`。
