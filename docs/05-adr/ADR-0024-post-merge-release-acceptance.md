# ADR-0024：保留候选证据并追加合并后验收

- 状态：Accepted
- 日期：2026-07-28

## 背景

M2-RC1 在堆叠 PR 合并前生成，用于固定 M2-A～M2-H 的 Head、Schema、路由、生命周期和安全证据。PR #12～#20 合并后，原候选中“堆叠尚未合并”等 blocker 已不再反映现实状态。

直接修改原候选会改变 candidate digest，并破坏合并前证据的可审计性。

## 决策

原 M2-RC1 候选和合并前 Artifact 保持不可变。

新增独立 `m2-governed-planning-post-merge-acceptance/v1` 记录，绑定：

- 原 candidate digest；
- 最终 M2 merge commit；
- PR #12～#20 的 merge commit；
- 合并前 Validation 和 Artifact；
- 合并后 `main` CI 与 Artifact；
- resolved blockers；
- open blockers。

Post-merge Validator 只验证仓库内声明的一致性，不主动查询 GitHub、镜像仓库、Secret Manager、Kubernetes 集群或审批系统。

## 结果

- 合并前候选和合并后验收可以独立审计；
- 已解决 blocker 不会污染当前发布判断；
- 缺少外部证据时保持 `productionEligible=false`；
- 生产晋级需要后续追加真实 Registry、Secret、Cluster 和审批证据，而不是修改历史候选。
