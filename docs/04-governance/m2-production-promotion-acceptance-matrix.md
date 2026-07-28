# M2 Production Promotion Acceptance Matrix

| ID | 控制 | 自动验证 | 初始状态 | 关闭条件 |
|---|---|---|---|---|
| PP-01 | 历史 candidate 不可变 | 重新计算 canonical SHA-256 | 必须通过 | digest 精确等于固定值 |
| PP-02 | post-merge acceptance 不可变 | 重新计算 canonical SHA-256 | 必须通过 | digest 精确等于固定值 |
| PP-03 | 精确晋级源 | 40 位 Git SHA 与固定 `main` SHA | 必须通过 | `promotionSource.mainSha` 精确匹配 |
| PP-04 | 最终 `main` push CI | run ID、source SHA、五类 Artifact digest | 未验证 | 所有字段完整且不含占位值 |
| PP-05 | GHCR 不可变镜像 | `@sha256:` 引用与 Registry digest 同值 | 缺失 | build/pull/SBOM/Attestation 证据完整 |
| PP-06 | 本地 Image ID 禁止冒充 | 拒绝 `sha256:` 以外的 image reference 与 `docker-image://` | 必须通过 | 仅接受 Registry digest |
| PP-07 | SBOM | SPDX/CycloneDX 文件 digest | 缺失 | `sha256:<64 hex>` 且由发布 Workflow 生成 |
| PP-08 | Provenance | GitHub Artifact Attestation 标识与 digest | 缺失 | provenance attestation 完整 |
| PP-09 | SBOM Attestation | GitHub Artifact Attestation 标识与 digest | 缺失 | SBOM attestation 完整 |
| PP-10 | Secret 引用治理 | Provider allow-list、版本化引用、敏感扫描 | 未配置 | 不含值，仅含引用 |
| PP-11 | 目标集群验证 | cluster ref、run、source/image/manifest digest | 未运行 | 全部字段完整且通过 |
| PP-12 | Change Approval | system、approval ID、approvedAt | 缺失 | 非占位且状态为 `APPROVED` |
| PP-13 | Release Owner Approval | system、approval ID、approvedAt | 缺失 | 非占位且状态为 `APPROVED` |
| PP-14 | Blocker 推导 | 由六个证据域确定性计算 | 必须通过 | resolved/open 不重叠且顺序固定 |
| PP-15 | Production eligibility | 决策一致性 | `false` | open blockers 为空时才允许 `true` |
| PP-16 | 敏感信息禁止 | canonical JSON 扫描 | 必须通过 | 无 token、密码、私钥、连接串、subject mapping、kubeconfig |
| PP-17 | 占位证据禁止 | placeholder/repeated-hex 检测 | 必须通过 | 关闭证据不可为示例或伪造格式 |
| PP-18 | Evidence Artifact | 独立 evidence generator 与 CI upload | 待 CI | Artifact 成功生成且无敏感信息 |

## 强制 Blocker 顺序

1. `main-branch-final-ci-not-verified`
2. `external-registry-digest-missing`
3. `production-secrets-not-configured`
4. `target-cluster-validation-not-run`
5. `change-approval-missing`
6. `release-owner-approval-missing`

Validator 必须按照上述顺序推导 `resolvedBlockers` 和 `openBlockers`，不得由提交者任意声明。
