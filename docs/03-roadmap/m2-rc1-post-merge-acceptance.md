# M2-RC1 — Post-Merge Acceptance Closure

## 目标

在不改写合并前 `M2-RC1` 候选及其 digest 的前提下，为已经进入 `main` 的 M2-A～M2-I 追加一份独立、可审计的合并后验收记录。

本切片不是 M2-J，不扩展产品能力，也不启动 M3。

## 已确认基线

- PR #12～#20 已按顺序合并；
- M2 功能树最终进入 `main`；
- 最终 M2 合并提交为 `8b004fa0617a470fb777bbd58b3cf8600e661a5c`；
- 合并后 `main` 与通过完整 PR Validation 的 M2-I Head 在文件树层面无差异；
- 合并前 M2-RC1 候选、Schema digest 和 Artifact 必须保持不可变。

## 新增证据

新增独立的 `POST_MERGE_ACCEPTANCE` 记录，必须包含：

- 原候选 ID、版本与 candidate digest；
- PR #12～#20 的合并状态和 merge commit；
- 合并后的 M2 源代码提交；
- 合并前最终 Validation run 与 Artifact digest；
- `main` push CI 的状态、run ID 和 Artifact digest；
- 已解决 blocker 与仍开放 blocker；
- 生产晋级资格。

## 阻断项处理

`m2-stack-prs-not-merged` 已解决，不得继续出现在开放 blocker 中。

在无法取得最终 `main` push Workflow run 和 Artifact 前，使用：

```text
main-branch-final-ci-not-verified
```

不得把 PR Validation 或文件树一致性替代成合并后 `main` CI。

以下生产阻断仍保持开放：

- external-registry-digest-missing；
- production-secrets-not-configured；
- target-cluster-validation-not-run；
- change-approval-missing；
- release-owner-approval-missing。

## 验收标准

- 原 `releases/m2/planning-release-candidate.json` 不修改；
- 新记录能区分 resolved/open blockers；
- resolved blocker 不得重新进入 open blockers；
- `productionEligible` 在所有开放 blocker 清零前固定为 `false`；
- Validator 不查询或伪造外部系统状态；
- Workflow 同时生成原候选证据和 post-merge acceptance 证据；
- 完整 Node、PostgreSQL 18、Deployment 和 Docker 硬化回归继续通过。
