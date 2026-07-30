# M2-RC1 发布说明

## 当前状态

M2-RC1 已完成仓库级发布收口。

```text
repositoryReleaseReady=true
environmentPromotionEvaluated=false
environmentPromotionEligible=null
repositoryBlockers=[]
```

M2-RC1 不再是“堆叠尚未合并”的候选状态。M2-A～M2-I、合并后验收、不可变 GHCR 发布、Registry digest 绑定、Portable Release Readiness 和最终 main-push 验证均已完成。

## 能力范围

- M2-A～M2-C：合同、Capability Catalog、确定性 Planner、Coverage、Provenance 与 DAG；
- M2-D～M2-F：PostgreSQL Registry、治理、CAS、Review、Freeze 与原子 Orchestration；
- M2-G～M2-H：五条 Test Plan 查询路由与统一只读服务；
- M2-I：Release Candidate、Schema/Stack digest 与正式候选证据；
- M2-RC1：堆叠合并、main 验收、不可变镜像、SBOM、Attestation、Deployment binding 与可移植发布就绪。

## 最终证据

- Release source SHA：`6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7`；
- Immutable image digest：`sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13`；
- Portable Readiness base main：`286bdab429ee7365082b8b5abaff1b5b981d9ef7`；
- Final closure base main：`70b06e28e48c38d8b7feed29177144d35cb96069`；
- Final observation Artifact：`8751973494`；
- Final observation digest：`sha256:38263d550408d8ca96e9c951ec2f22ccfde2bc587229ae991dfc8f1eca8fad24`。

## 部署边界

仓库发布就绪不等于某个环境已经部署。部署方负责提供运行时配置、替换模板占位值、验证目标环境，并完成自己的本地治理流程。

仓库不要求特定 Secret Provider、目标集群 ID 或审批单编号，也不保存真实 Secret 值。

## 下一阶段

下一阶段为 `M3-R0 — Execution Adapter Foundation`。M3-R0 仅建立合同和安全边界，不执行 k6，不创建 Worker、Queue、Scheduler 或 Kubernetes Job。
