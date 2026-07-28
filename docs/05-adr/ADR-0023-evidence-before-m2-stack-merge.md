# ADR-0023：M2 堆叠合并前先固定发布证据

- 状态：Accepted
- 日期：2026-07-28

## 决策

M2-I 在任何 M2 PR 合并前生成独立的 M2-RC1 候选定义和证据。候选固定 PR #12～#19 的 base/head、规划 Schema、十条只读路由、冻结生命周期、Deployment digest 和安全/故障控制。

M1-RC1 与 M2-RC1 使用不同 Schema、文件和 Artifact 名称。M2-I 不允许覆盖 M1 历史证据，也不把本地镜像 ID当作外部 Registry digest。

## 结果

堆叠可在合并前独立审查；合并必须从 PR #12 开始，并在每次合并后重新确认下一 PR 的 Base、CI 与差异。`productionEligible` 在外部晋级条件满足前固定为 `false`。
