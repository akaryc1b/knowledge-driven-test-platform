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

M3-R0 Contract Foundation、M3-R1 Deterministic Non-Executing k6 API Spec Compiler、M3-R2 Governed Deterministic Source Generation 和 M3-R3 Governed Local Runtime Boundary 均已完成正式合并与 exact-main 永久验收。

M3-R3 最终基线：

```text
m3R3Accepted=true
mainSha=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
finalManifestRun=31151845526
finalManifestArtifact=8983613200
finalManifestArtifactDigest=sha256:579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
finalManifestCanonicalEvidenceDigest=65579189cf11a930f621333824219faa9e5ca11516041ab7188ed68b11ab6990
runtimeAdmissionComplete=true
localProcessBoundaryComplete=true
boundedProcessLifecycleComplete=true
sanitizedRuntimeResultComplete=true
rawRuntimeOutputCollected=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
repositoryBlockers=[]
```

M3-R3 保留以下已接受边界：

- 单一 shell-free `node:child_process.spawn` 适配边界；
- 有界启动、超时、取消、强制终止和 settle-once 生命周期；
- 不公开 stdout、stderr、数字 PID、原始错误、堆栈、环境值或主机路径；
- Source Bundle 保持内容寻址和不可变；
- 文件结果收集继续因缺少独立 Governed Output Root 而延期。

### 当前阶段：M3-R4-R0 Governed Output Root Rebaseline

M3-R4 在任何文件结果收集之前建立独立的可写输出根目录治理边界。R0 只允许：

- 重新绑定 M3-R3 最终 exact-main Evidence；
- 冻结根目录所有权、身份、路径语法、对象类型、容量、生命周期、清理和失败要求；
- 建立 ADR、威胁模型、边界矩阵、交接和静态测试；
- 保持产品运行时代码、Invocation Plan、Source Bundle 和 Node Adapter 不变；
- 使用 Draft PR 和自然 CI 完成 exact-Head 验收。

```text
m3R3FinalClosureReverified=true
m3R4Started=true
m3R4R0Started=true
m3R4ProductImplementationStarted=false
governedOutputRootDefined=false
governedOutputRootImplemented=false
outputDirectoryCreated=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-R0
```

M3-R4-P1 及后续 allocator、resolver、collector、fault/security acceptance 与 G1–G4 均保持冻结，必须在 R0 exact-Head 验收后通过新的独立指令启动。

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
