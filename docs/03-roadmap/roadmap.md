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

M3-R0 Contract Foundation、M3-R1 Deterministic Non-Executing k6 API Spec
Compiler、M3-R2 Governed Deterministic Source Generation 和 M3-R3 Governed
Local Runtime Boundary 均已完成正式合并与 exact-main 永久验收。

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

### 已接受阶段：M3-R4-R0 Governed Output Root Rebaseline

R0 已在 exact Head `e522c13065dd77770d414a727d030a5108488eae`
完成边界冻结和自然 CI 验收。R0 PR #78 继续保持 Draft/Open/Unmerged。

### 已接受阶段：M3-R4-P1 Versioned Output-Root Contracts

P1 已在 exact Head `3f0459700e5d7e651011f8addeda8e8164a0ccbc`
完成自然 CI 与独立 Artifact 审计：

```text
p1Issue=79
p1PullRequest=80
p1NaturalWorkflowSuccess=17/17
p1ArtifactId=9097350510
p1ArtifactApiDigest=sha256:99b6a309b3c335d869d21187538285318b57daacc2df78973eb7d422fa2bd84a
p1CanonicalEvidenceDigest=9d46327e75671673a9a1cb75beb122135a54eb2508433ebc55ef255aae86fc68
p1SchemaCatalogDigest=09a782340e4a8ff0d0335445433ebad9b5a5464c4f654930f964677f618c67bb
```

P1 固定平台拥有的逻辑输出根、一个精确 summary descriptor、有界限制和
七状态生命周期语法，但没有授权任何效果。

### 当前阶段：M3-R4-P2 Injected Trusted Output-Root Port

P2 建立 fake-only 注入边界：

- 关闭且版本化的 port、allocation、resolution 与 Evidence 合同；
- 只允许平台拥有的逻辑 `DECLARED -> ALLOCATED` 转换；
- 只返回 path-independent opaque allocation/artifact handles；
- 只解析 P1 中的 `outputs/summary.json` descriptor；
- 不接受 caller path，不公开 absolute host path；
- 不创建真实目录，不打开、读取或写入文件；
- Node.js 22 baseline 与 Node.js 24 fake-only compatibility；
- Draft PR 自然 CI 和永久 Artifact。

```text
m3R4P2Started=true
m3R4P2ImplementationComplete=true
implementationStatus=INJECTED_FAKE_ONLY
logicalRootAllocationSupported=true
logicalRootAllocated=true
artifactResolutionSupported=true
realFilesystemPortImplemented=false
outputDirectoryCreated=false
hostPathIncluded=false
callerPathAccepted=false
fileOpened=false
fileRead=false
fileWritten=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
m3R4P3Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P3
```

P3 bounded collector、P4 fault/security acceptance 与 G1–G4 均保持冻结。
P2 exact-Head 验收不自动授权 Ready、Merge 或真实文件系统效果。

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
