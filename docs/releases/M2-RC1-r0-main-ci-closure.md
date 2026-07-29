# M2-RC1 R0 Main CI Closure

## 目标

本切片在 R0 Production Promotion Contract 合并后，以追加证据核验并绑定精确的 R0 merge commit：

`edf09333d9be9ea6839b8cf4d18efed95cfba821`

该提交是 PR #22 的 merge commit，也是修复 push 环境 release evidence 分支归一化后的第一个 `main` 候选。

## 只读采集结果

独立 PR Workflow 使用 `contents: read` 与 `actions: read` 查询 GitHub Actions API，并生成 `m2-r0-main-ci-closure-evidence` Artifact。

已确认的真实证据：

- `main` push run：`30423781549`；
- Workflow ID：`321111055`；
- Validate job：`90485717866`，`success`；
- Deployment Validator step：`Run deployment validation`，`success`；
- PostgreSQL 18 job：`90485717817`，`success`；
- collector 判定：`eligibleForClosure=true`。

永久 Artifact digest：

- M1 evidence：`sha256:5fd6a0a992fc5042ec24e22ec5a9dbd83c73fd8f41179676b2cc0d0ec3b7c27b`；
- M2 Candidate evidence：`sha256:52fa0384bf868e7dbe4115fcb5755eed971f624346d70f201c0c52e7530ba0c1`；
- M2 Post-Merge evidence：`sha256:5b5cd301970cddd6aeea29b70108a128983262480a79d39d6371f3c5ef48b6ae`；
- PostgreSQL validation：`sha256:8008931c382ed28db60829d7ae729c3fb35547ec546dd5357c01498eac6dcd42`；
- Repository validation：`sha256:1fd29192b102e0767a91d11649c6056f4a6261e8159f8dee34698a3ffd849cf1`；
- Deployment validation：`sha256:99a28a45d3841ac234b05ca22442980871a9534ee2d92247b1d16b116b49d5a6`。

Collector Workflow run `30424077540` 生成的独立 Artifact digest 为：

`sha256:a44105f39c5a7e80886dc83277e7b15be328e47de4ca2e475ea89a1f98b90581`

## 永久绑定

`releases/m2/r0-main-ci-closure.json` 保存上述精确 run、job、step、Artifact ID 与 digest。

独立 Validator 必须：

- 固定验证 source SHA、run ID、Workflow ID、job ID 和 Deployment step；
- 固定验证六份 Artifact 的名称、ID 与 digest；
- 验证 Production Promotion 使用完全相同的 source/run/digest；
- 拒绝失败 run、篡改 digest、重新打开已关闭 blocker 或注入敏感材料；
- 继续验证原 candidate 与 post-merge acceptance 未被修改。

## Blocker 结果

真实证据只关闭：

- `main-branch-final-ci-not-verified`。

以下 blocker 继续开放：

- `external-registry-digest-missing`；
- `production-secrets-not-configured`；
- `target-cluster-validation-not-run`；
- `change-approval-missing`；
- `release-owner-approval-missing`。

因此 `productionEligible=false`。

## 历史失败观测

`releases/m2/main-branch-ci-observation.json` 继续不可变保存旧 `main@991b5f0...` 的失败 run `30356400001`。成功 closure 是追加证据，不覆盖、不删除也不重写历史失败。

## 明确不在范围内

- GHCR 发布与 Registry digest 绑定；
- R1-B Deployment 修改；
- Secret、目标集群和审批配置；
- 生产部署；
- M2-J、M3、Worker、Queue、Scheduler、Kubernetes Job、Allure、k6/xk6 或 Playwright。
