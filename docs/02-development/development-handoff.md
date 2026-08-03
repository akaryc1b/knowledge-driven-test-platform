# M3-R2 Governed k6 API Source Generation 开发交接

## 精确重新基线化

```text
main@ab93321738222c087e6f3c90fd39e092116cf3c8
pr44Merged=true
pr44MergeSha=ab93321738222c087e6f3c90fd39e092116cf3c8
pr45ClosedDraftUnmerged=true
openPullRequests=0
existingM3R2Branches=0
```

M3-R1 exact-main Dedicated Run 为 `30600867230`，Artifact 为 `8781826637`，digest 为 `sha256:689773070e76bcd3cc29e815c9ed27249bd856b0f09a93a0e6a6d6ecee7a1bae`。Artifact 未过期且绑定 exact main。

## 历史验收兼容锚点

M2-RC1 已正式关闭。M3-R0 已完成 Contract-only Foundation，并且其历史入口约束“不得启动执行器实现”继续作为永久 anti-regression 哨兵保留。该历史表述不表示当前回退到 M3-R0；当前正式下一切片仍为 M3-R2-P1。

## 合并后 Review 重新评估

PR #44 在合并后收到三个有效 P2 Review。R0 已将其作为前置 blocker 关闭：

- named JavaScript function declaration 不再绕过 executable-material gate；
- Compilation Evidence digest 绑定 `decision` 与 `safetyBoundary`；
- `K6ApiAssertion` 使用 closed discriminated union。

这些修改只加固 M3-R1 合同，不生成 Source，不启动 Runtime。

## R0 已接受边界

R0 已完成：

```text
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
threatModelAccepted=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
nextRequiredSlice=M3-R2-P1
```

上述 `nextRequiredSlice=M3-R2-P1` 是 R0 永久证据，不应被改写。

## M3-R2-P1 当前完成状态

P1 只增加 versioned Source Generation Contract 与 Schema：

- `K6ApiSourceRenderingPolicy`：固定 UTF-8、LF、双空格缩进、引号、尾换行、排序和 identity exclusion；
- `K6ApiSourceGeneratorDescriptor`：固定 `CONTRACT_ONLY` 状态、`k6`/`k6/http` allow-list、资源上限和 configuration digest；
- `K6ApiSourceGenerationRequest`：只绑定已验证的 M3-R1 Spec、Bundle 与 Compilation Evidence；
- P1 Validator、示例、测试、Schema Catalog 与只读永久 Workflow。

P1 不包含 renderer，不包含 source bytes，不包含 source artifact，也不实现任何 Runtime。请求元数据不会进入未来 Source identity；Spec、Bundle、Compilation Evidence、Generator Configuration、Source Format 与 Rendering Policy digest 必须进入 identity。

```text
sourceGenerationContractReady=true
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
secretAccessed=false
nextRequiredSlice=M3-R2-P2
repositoryBlockers=[]
```

`nextRequiredSlice=M3-R2-P2` 只表示顺序，不授权本交接启动 P2。

## 冻结边界

不得调用 k6、xk6、Playwright、外部进程、Shell、Node VM、`eval`、`Function` 或 dynamic import；不得访问目标网络、数据库、Secret、凭据文件或生产环境；不得创建执行目录、容器、Kubernetes 资源、Worker、Queue、Scheduler、Runtime Result 或 Allure。

P1 Draft PR 不构成 Ready 或 merge 授权。后续合并必须获得绑定 PR 编号和精确 40 位 Head SHA 的独立明确授权，并且只能使用普通 Merge Commit。
