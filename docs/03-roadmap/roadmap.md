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

M3-R0、M3-R1、M3-R2 和 M3-R3 已完成正式合并与 exact-main 永久验收。

```text
m3R3Accepted=true
mainSha=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
finalManifestRun=31151845526
finalManifestArtifact=8983613200
runtimeAdmissionComplete=true
localProcessBoundaryComplete=true
boundedProcessLifecycleComplete=true
sanitizedRuntimeResultComplete=true
rawRuntimeOutputCollected=false
```

### 已接受阶段：M3-R4-R0 Governed Output Root Rebaseline

```text
r0Head=e522c13065dd77770d414a727d030a5108488eae
m3R4R0BoundaryFreezeComplete=true
m3R4R0ExactHeadAcceptanceComplete=true
m3R4R0ReadyMarked=false
m3R4R0Merged=false
```

### 已接受阶段：M3-R4-P1 Versioned Output-Root Contracts

```text
p1Head=3f0459700e5d7e651011f8addeda8e8164a0ccbc
m3R4P1ExactHeadAcceptanceComplete=true
m3R4P1ArtifactIndependentlyVerified=true
implementationStatus=CONTRACT_ONLY
artifactRelativePath=outputs/summary.json
maxFiles=1
maxFileBytes=1048576
maxTotalBytes=1048576
maxJsonDepth=32
maxCollectionDurationMs=10000
```

### 已接受阶段：M3-R4-P2 Injected Trusted Output-Root Port

```text
p2Head=b66f223cc4453da4cab4af4df2676327aaa4bd76
m3R4P2ExactHeadAcceptanceComplete=true
m3R4P2ArtifactIndependentlyVerified=true
implementationStatus=INJECTED_FAKE_ONLY
logicalRootAllocated=true
exactArtifactResolved=true
realFilesystemPortImplemented=false
outputDirectoryCreated=false
```

### 已接受阶段：M3-R4-P3 Bounded Sealed-Root Result Collector

```text
p3Head=9a11bd749620af23735955fb3c90b034c8e63944
m3R4P3Started=true
m3R4P3ImplementationComplete=true
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
implementationStatus=INJECTED_FAKE_ONLY
logicalRootSealed=true
boundedJsonResultCollected=true
rawPayloadPersisted=false
rawPayloadIncludedInEvidence=false
realFilesystemCollectorImplemented=false
realHostFileReadPerformed=false
```

### 当前阶段：M3-R4-P4 Fault, Security and Compatibility Acceptance

P4 只增加验收、Schema、Validator、Workflow 和治理记录，不修改 P3
运行时产品：

```text
slice=M3-R4-P4
issue=85
m3R4P4Started=true
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=false
implementationStatus=ACCEPTANCE_ONLY
p3CollectorProductChanged=false
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
m3R4G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-G1
```

P4 完成后进入 G1–G4 正式验收与 exact-main 收口，不自动授权真实文件系统
适配器、k6 执行或任何 M4 能力。

## M4 — Multi-Project Operations

- 项目配置中心；
- 环境和凭据绑定；
- 执行队列与 Worker；
- 多项目看板；
- 资源配额和隔离。

M4 未启动。M3-R4 不授权任何 Worker、Queue、Scheduler 或多项目运维能力。

## M5 — AI-Assisted Knowledge and Testing

- PRD/OpenAPI/DDL 候选知识提取；
- 测试草案生成；
- 失败归因；
- 人工审核闭环；
- AI 操作审计和安全边界。
