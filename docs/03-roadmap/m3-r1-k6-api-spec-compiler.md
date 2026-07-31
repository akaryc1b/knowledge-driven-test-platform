# M3-R1 — Deterministic Non-Executing k6 API Spec Compiler

## 已接受基线

M3-R0 已在 `main@42402fb82ca8b357a4c2a6dce56b9ce09c11c820` 完成精确 main 验收。M3-R1 只建立 `k6-api` Adapter 的确定性映射合同、结构化 IR、Artifact Bundle 和 Compilation Evidence。

## 输入与输出

输入必须是已验证的 `ExecutionAdapterDescriptor`、`ExecutionRequest`、FROZEN Test Plan Record、已发布 Knowledge Snapshot 绑定、固定 Compiler version、versioned environment digest 和 capability allow-list。

输出为 versioned、`additionalProperties=false` 的：

- `K6ApiExecutionSpec`；
- `K6ApiRequestGroup`；
- `K6ApiOperation`；
- `K6ApiAssertion`；
- `K6ApiThreshold`；
- `K6ApiArtifactBundle`；
- `K6ApiCompilationEvidence`。

相同输入产生相同 canonical JSON、ID 与 SHA-256 digest。编译时间仅进入非身份型 metadata。

## 非执行边界

Compiler 只验证、规范化、映射和计算 digest。不得调用 k6、xk6 或 Playwright，不得生成可运行 JavaScript，不得使用外部进程、网络、数据库、凭据文件、临时执行目录、容器或 Kubernetes 资源。

```text
apiAdapterCompilerReady=true
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
nextRequiredSlice=M3-R2
repositoryBlockers=[]
```
