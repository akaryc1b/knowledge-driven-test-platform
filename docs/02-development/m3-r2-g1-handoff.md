# M3-R2 Governed k6 API Source Generation — G1 交接

## 历史交接兼容说明

`docs/02-development/development-handoff.md` 是 M2-RC1 Final Closure 固定的 M3-R0 入口证据，必须继续保留 `M2-RC1 已正式关闭`、`M3-R0` 与 `不得启动执行器实现` 等历史兼容标记。该文件不得被当作当前阶段状态页改写。

当前 M3-R2-G1 状态由本文件、M3-R2 主路线图、Release 文档、PR 描述和永久验收评论追加记录。

## 已接受前任基线

```text
main@ab93321738222c087e6f3c90fd39e092116cf3c8
acceptedP5Head=33c90625b9c689387272eef58c14a0742ed7b17f
acceptedP5Run=30801984826
acceptedP5Artifact=8851181456
acceptedP5ArtifactDigest=sha256:9cb02722b682952da573f1f6754692589107ee985da14ccbcf441c96fe28b1c2
acceptedP5PostgresArtifact=8851168200
acceptedP5PostgresArtifactDigest=sha256:624d8b2a8af36ae73ad7c958b6d47b03bf9baf40f2fdb639beb866073b6b3bf1
```

P5 已独立接受确定性、完整绑定、完整重哈希伪造拒绝、注入抵抗、敏感材料边界、非执行、兼容性、持久化故障与并发。固定 Source、Bundle、Manifest、Receipt 和 Publication Evidence 身份保持不变。

## G1 最终范围审计

G1 不增加产品能力，只完成最终基线、范围完整性、永久门禁和 PR 证据一致性审计：

- 变更仍限定在 `@kdtp/k6-api-adapter` 的 Source Contract、Renderer、独立静态 Validator、本地内容寻址 Bundle Publisher、Schema、测试、Evidence、只读 Workflow 与治理文档；
- 未增加 Runtime Consumer、远程 Publisher、执行 API、Worker、Queue、Scheduler、Kubernetes 执行资源、Runtime Result 或 Allure；
- `main` 仍为接受的 M3-R1 Merge SHA，PR 分支 behind 为 0；
- 根级 `npm run validate` 永久包含 P5 Validator，避免常规 Repository Validator 在 P4 后停止；
- P5 Artifact 的权威摘要为 GitHub API、上传日志与下载 ZIP 一致的 `sha256:9cb02722b682952da573f1f6754692589107ee985da14ccbcf441c96fe28b1c2`；错误值 `b04261ad...ff9b` 不得继续使用；
- P5 ZIP 中两个仅大小写不同的文档条目均真实存在。权威复核必须直接读取 ZIP entry 并校验摘要，不能把大小写不敏感文件系统上的普通解压结果当作唯一证据；
- 历史顶层交接继续作为不可改写的 M2 Final Closure 锚点，本文件承担当前 G1 交接职责。

## 当前安全边界

```text
sourceGenerationAcceptanceComplete=true
sourceGenerationContractReady=true
deterministicSourceRendererReady=true
independentStaticValidatorReady=true
sourceArtifactContractReady=true
sourceBundleContractReady=true
sourceGenerated=true
sourceStaticallyValidated=true
sourceArtifactCreated=true
sourcePersisted=true
artifactPublished=true
remoteArtifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
nodeVmUsed=false
evalUsed=false
dynamicImportUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
temporaryExecutionDirectoryCreated=false
containerStarted=false
kubernetesResourceCreated=false
workerAdded=false
queueAdded=false
schedulerAdded=false
runtimeResultCollected=false
allureImplemented=false
repositoryBlockers=[]
```

## 下一阶段控制

G1 只有在最终 correction Head 的完整 exact-Head CI、Artifact 与永久 PR 评论完成后才正式接受。接受后：

```text
nextRequiredSlice=M3-R2-G2
readyMarked=false
merged=false
m3R3Started=false
```

G2 不得自动启动。任何 Ready 或 merge 动作仍需新的独立用户消息，同时绑定 PR #46 与当时精确 40 字符 Head SHA。最终仅允许普通 Merge Commit；禁止 squash、rebase、auto-merge、force-push 与历史重写。
