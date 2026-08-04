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

M3-R0 Contract Foundation、M3-R1 Deterministic Non-Executing k6 API Spec Compiler 与 M3-R2 Governed Deterministic k6 API Source Generation 已完成正式合并和精确 main 验收。

M3-R2 的历史切片记录为：

- R0：Source Generation Boundary、Threat Model 与前任 Review 闭环；
- P1：Versioned Source Generation Contracts and Schemas；
- P2：确定性、纯内存、未执行的 k6 JavaScript Source Renderer；
- P3：独立静态 Source Validator 与不可变 Source Artifact；
- P4：本地内容寻址 Source Bundle、Manifest、Provenance、Receipt 与 Publication Evidence；
- P5：确定性、绑定、注入、敏感材料、非执行、兼容性、故障与并发最终验收；
- G1–G4：完整范围审计、正式验收、普通 Merge Commit 与 exact-main 永久验证。

以下 P1/P2 决策块作为阶段历史记录保留：

```text
sourceGenerationContractReady=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
nextRequiredSlice=M3-R2-P2
```

```text
deterministicSourceRendererReady=true
sourceGenerationStarted=true
sourceGenerated=true
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
nextRequiredSlice=M3-R2-P3
```

M3-R2 最终精确 main 基线：

```text
m3R2Accepted=true
mainSha=62e1deb6b6f9c8e82188c0fe8e66d83350d6f9cf
sourceGenerationAcceptanceComplete=true
sourcePersisted=true
artifactPublished=true
remoteArtifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
repositoryBlockers=[]
```

### 当前阶段：M3-R3-R0 Runtime Admission

M3-R3-R0 在已验收 Source Bundle 与任何未来进程 Adapter 之间建立 admission-only 边界。当前切片允许：

- 固定且版本化的 Runtime Policy；
- Execution Request、M3-R1 Spec/Compilation Evidence 与 M3-R2 Source Publication 的精确绑定；
- 有界 VUs、iterations、duration 与 graceful stop；
- 仅包含 argv 数组的确定性 Invocation Plan；
- 允许的环境变量名称与输出 Artifact 类型白名单；
- Admission Request、Invocation Plan 与 Admission Evidence 的 canonical SHA-256 身份；
- 闭合 Draft 2020-12 Schema、Repository Validator、永久 Workflow 与 Artifact Evidence。

R0 中的 `k6` 只是关闭合同里的 executable label。R0 不安装、发现或调用该二进制，也不创建执行目录或访问 Target/Secret。

```text
runtimeAdmissionContractReady=true
invocationPlanReady=true
executionImplementationStarted=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
shellUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
runtimeResultCollected=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
```

M3-R3-P1 及后续本地进程 Adapter、生命周期、取消、结果收集、Fault/Security Acceptance 与 G1–G4 均保持冻结，必须在 R0 正式验收后通过新的独立指令启动。

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
