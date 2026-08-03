# 总体路线图

## M0 — Knowledge Foundation

- Monorepo 与开发基线；
- 多项目知识模型；
- 分层规则解析；
- 不可变知识快照；
- 示例项目和 CI。

状态：完成。

## M1 — Registry and Governance

- 知识注册服务；
- 草稿、审核、发布、废弃；
- 项目权限和审计；
- JSON Schema 与版本迁移；
- 快照持久化。

状态：完成并形成 M1-RC1。

## M2 — Test Planning

- 边界到测试矩阵；
- 风险优先级；
- 变更影响分析；
- 覆盖缺口和孤儿测试识别；
- Durable Registry、Governance、Orchestration 与只读查询；
- 不可变镜像和 Portable Release Readiness。

状态：M2-RC1 仓库级发布收口完成。

## M3 — k6 Execution Adapters

M3-R0 Contract Foundation 与 M3-R1 Deterministic Non-Executing k6 API Spec Compiler 已完成精确 main 验收。M3-R2 已按独立安全切片完成：

- R0：Source Generation 范围冻结、Threat Model 与前任 Review 闭环；
- P1：Versioned Source Generation Contracts and Schemas；
- P2：确定性纯内存 k6 JavaScript Source Renderer；
- P3：独立静态 Source Validator 与不可变 Source Artifact；
- P4：本地内容寻址 Source Bundle、Manifest、Provenance、Receipt 与 Publication Evidence；
- P5：确定性、绑定、注入、敏感材料、非执行、兼容性、故障与并发最终验收；
- G1：最终范围、默认 Repository Validator、永久 Evidence 与 PR 元数据一致性审计。

M3-R2 允许生成、静态验证并发布到受治理的本地内容寻址文件系统 Store，但仍明确禁止：

- k6、xk6、Playwright 或任意 Source 执行；
- Runtime Consumer、远程 Registry/Object Storage Publisher 或执行 API；
- 目标网络、数据库、Secret、凭据文件与生产环境访问；
- Worker、Queue、Scheduler、容器、Kubernetes 执行资源、Runtime Result 与 Allure。

```text
sourceGenerationAcceptanceComplete=true
sourcePersisted=true
artifactPublished=true
remoteArtifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
repositoryBlockers=[]
nextRequiredSlice=M3-R2-G2
```

G2 不得自动启动。Ready、普通 Merge Commit 与后续 exact-main 验证必须继续按独立授权和独立安全阶段推进。M3-R3 Runtime 保持冻结。

## M4 — Multi-Project Operations

- 项目配置中心；
- 环境和凭据绑定；
- 执行队列与 Worker；
- 多项目看板；
- 资源配额和隔离。

## M5 — AI-Assisted Knowledge and Testing

- PRD/OpenAPI/DDL 候选知识提取；
- 测试草案生成；
- 失败归因；
- 人工审核闭环；
- AI 操作审计和安全边界。
