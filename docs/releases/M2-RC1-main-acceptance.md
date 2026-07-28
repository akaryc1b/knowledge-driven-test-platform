# M2-RC1 合并后验收

## 当前状态

M2-A～M2-I 已合并到 `main`。这解决了原候选中的 `m2-stack-prs-not-merged` 阻断项。

原 M2-RC1 仍是合并前候选，不修改、不重算 digest。合并后状态通过独立 acceptance 记录表达。

## 已解决

- PR #12～#20 已按顺序合并；
- M2 功能树已进入 `main`；
- 合并过程没有引入额外文件差异；
- M1-RC1 与 M2-RC1 证据仍相互独立。

## 待验证

- 最终 `main` push Workflow run ID；
- 最终 `main` Node/PostgreSQL 18/Docker/Deployment 结果；
- 最终 `main` M1/M2 Artifact digest。

在上述信息未形成永久证据前，状态使用 `main-branch-final-ci-not-verified`。

## 仍然阻断生产晋级

- 外部镜像仓库不可变 digest；
- 生产 Secret 管理引用；
- 目标 Kubernetes 集群验证；
- 变更审批；
- 独立 Release Owner 批准。

因此当前仍为：

```text
productionEligible=false
```
