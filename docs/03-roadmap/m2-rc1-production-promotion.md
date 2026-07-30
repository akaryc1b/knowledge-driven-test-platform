# M2-RC1 Production Promotion Roadmap

## R0 — Production Promotion Contract

状态：完成并已合并。

交付：

1. 独立 `PRODUCTION_PROMOTION` 记录与 v3 Schema；
2. 独立 evidence generator；
3. 本地确定性 Validator；
4. candidate 与 post-merge acceptance digest 不可变校验；
5. blocker 到证据字段的一一映射；
6. Node、PostgreSQL evidence、Repository Validator 和 CI Artifact；
7. 敏感信息与占位值拒绝测试；
8. 旧 `main@991b5f0...` 失败 run 的追加式历史观测；
9. R0 merge commit `edf09333d9be9ea6839b8cf4d18efed95cfba821` 的真实成功 push run；
10. 独立 `r0-main-ci-closure.json` 与防篡改 Validator。

R0 关闭：

- `main-branch-final-ci-not-verified`。

## R1-A — Immutable GHCR Image Release

状态：完成。真实发布 Workflow run `30440674461` 成功。

交付：

1. 仅由 `workflow_dispatch` 启动的受控发布 Workflow；
2. 精确 `main@6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7` 来源验证；
3. 完整 Node、Repository、Deployment、M1/M2/Post-Merge/Promotion、main-CI closure 与 PostgreSQL 18 验收；
4. GHCR 构建与推送；
5. Registry digest `sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13`；
6. 非 Root 与 hardened runtime 验证；
7. SPDX JSON SBOM；
8. provenance 与 SBOM attestation；
9. 不可变引用回拉和 digest 复核；
10. `m2-release-image-evidence/v1` Artifact。

R1-A 只创建真实外部证据，不修改 Promotion 或 Deployment。

## R1-B — Registry Digest Binding

状态：本独立 Draft PR 正在实施，尚未合并。

交付：

1. 将 Deployment 从可变标签绑定到完整 `@sha256:` 引用；
2. 将真实 build run、source SHA、main CI、SBOM、Attestation 和 pull verification 写入 Production Promotion；
3. 保存 R1-A release evidence 的仓库副本；
4. 新增 `m2-r1b-image-binding/v1` 与 evidence schema；
5. 独立重算 release evidence、binding、Promotion 与 Deployment canonical digest；
6. 永久 PR/push Validation Artifact；
7. 只读手动 R1-B 验收 Workflow；
8. 仅关闭 `external-registry-digest-missing`。

R1-B 不配置 Secret、不访问目标集群、不创建审批，也不执行生产 rollout。

## 当前 Blocker

已解决：

- `main-branch-final-ci-not-verified`；
- `external-registry-digest-missing`。

继续开放：

- `production-secrets-not-configured`；
- `target-cluster-validation-not-run`；
- `change-approval-missing`；
- `release-owner-approval-missing`。

`productionEligible=false`。

## 后续条件切片

只有在取得真实、非占位、可独立验证的外部证据后，才允许分别推进：

- Production Secret Provider 与版本化引用；
- 目标集群只读验证；
- Change Approval；
- Release Owner Approval。

任何后续切片都不得由 R1-B 代为声明完成。

## 冻结范围

本 Roadmap 不启动 M2-J 或 M3，不增加执行型测试基础设施，不创建生产资源，也不自动合并任何 PR。
