# M2-RC1 Release Readiness Roadmap

## 当前权威结论

M2-RC1 的仓库级目标是 **Portable Release Readiness**，不是替任意部署方完成某个固定生产环境的上线。

仓库必须证明：

1. 候选与合并后证据不可变；
2. 精确 `main` CI 已通过；
3. GHCR 镜像以真实 Registry digest 发布；
4. SBOM、Provenance 与 SBOM Attestation 完整；
5. Kubernetes 模板使用不可变镜像并满足非 Root、只读文件系统和最小权限基线；
6. 运行时配置合同完整，且不在仓库保存敏感值；
7. 部署模板不强制 AWS、Azure、GCP、Vault 或 External Secrets 等特定 Provider。

仓库不负责声明：

- 某个生产 Secret Provider 已配置；
- 某个目标 Kubernetes 集群已验证；
- 某个 Change Approval 已批准；
- 某个 Release Owner 已批准；
- 某个具体环境已经完成生产晋级。

当前权威决策：

- `repositoryReleaseReady=true`
- `environmentPromotionEvaluated=false`
- `environmentPromotionEligible=null`
- `repositoryBlockers=[]`

## 已完成的历史切片

### R0 — Production Promotion Contract

完成并已合并。建立了不可变历史证据、最终 `main` CI 观察和 blocker 推导模型。

### R1-A — Immutable GHCR Image Release

完成。真实发布 Workflow Run：`30440674461`。

固定证据：

- Source SHA：`6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7`
- Registry digest：`sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13`
- SPDX JSON SBOM；
- Provenance Attestation：`37705043`；
- SBOM Attestation：`37705058`；
- 不可变引用回拉验证通过。

### R1-B — Immutable Image Binding

完成并已合并。Deployment 已绑定完整 `@sha256:` 镜像引用，历史 Production Promotion 仅关闭 Registry digest blocker。

### R2-A — External Evidence Intake

完成并已合并。该切片建立了 Secret、Cluster、Change Approval 和 Release Owner Approval 的可选外部证据输入合同。

R2-A 的记录与 Schema 继续保留，作为需要集中环境晋级治理的部署方可选能力。它不再是仓库级发布的必需条件。

精确 post-merge closure：

- `main@286bdab429ee7365082b8b5abaff1b5b981d9ef7`
- General Validation Run：`30517143338`
- Independent R2-A Run：`30517143343`
- Read-only Observation Run：`30517188902`

## R2-Rebaseline — Portable Release Readiness

状态：当前独立安全切片。

目标：

1. 新增 `m2-portable-release-readiness/v1`；
2. 保留旧 `production-promotion.json`、R2-A Intake、R1-B Binding 和 Image Evidence 的不可变历史 digest；
3. 将仓库发布决策与具体环境晋级决策分离；
4. 将 Runtime Configuration 定义为 `OPERATOR_SUPPLIED`；
5. 明确 Provider-agnostic Secret delivery；
6. 禁止仓库保存 Secret 值或要求 Provider-specific metadata；
7. 将目标集群验证和本地审批移动到 Deployment Operator Responsibilities；
8. 提供确定性 Validator、Node/PG18 回归、Docker hardened runtime 和永久 Artifact。

## 原 R2-B～R2-E 的新定位

原计划：

1. R2-B：Production Secret Provider；
2. R2-C：Target Cluster Validation；
3. R2-D：Change Approval；
4. R2-E：Release Owner Approval。

以上切片不再作为仓库发布路线继续执行。

它们被重新归类为 **Deployment Instance Acceptance**，仅当某个组织实际部署该版本时，由该组织按照自己的基础设施和治理制度执行。部署方可以继续使用 R2-A Schema，也可以使用自己的 Secret、Cluster 和审批系统。

不得将部署方缺少上述数据解释为仓库发布失败。

## Runtime Configuration 边界

服务运行时要求：

- `KDTP_DATABASE_URL`
- `KDTP_OIDC_ISSUER`
- `KDTP_OIDC_JWKS_URI`
- `KDTP_OIDC_AUDIENCE`
- `KDTP_OIDC_SUBJECT_MAPPINGS_JSON`

仓库只定义字段、分类和安全边界：

- 数据库连接可以由 Kubernetes Secret、外部 Secret Provider 或 Workload Identity Adapter 提供；
- OIDC 地址和 Audience 可以由 ConfigMap 或环境 Overlay 提供；
- Subject Mapping 由部署方受控提供；
- 仓库不得提交真实密码、Token、私钥、连接串或生产 Subject Mapping；
- 仓库不得强制任何云厂商或 Secret Provider。

## 冻结范围

R2-Rebaseline 不：

- 创建或读取 Secret；
- 访问或修改目标集群；
- 创建审批；
- 执行 rollout 或切流；
- 重建或重新发布镜像；
- 修改 Registry digest；
- 启动 M2-J 或 M3；
- 自动合并任何 PR。
