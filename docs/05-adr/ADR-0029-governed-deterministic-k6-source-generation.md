# ADR-0029：受治理的确定性 k6 Source Generation 边界

## 状态

Accepted for M3-R2-R0.

## 背景

M3-R1 已将 FROZEN Test Plan 编译为中立、不可执行的 `K6ApiExecutionSpec`。下一步需要把该 IR 转换为受控 k6 JavaScript，但生成文本与执行文本必须继续隔离。合并后的 PR #44 又出现了三个有效 P2 Review，说明 source generation 不能建立在未关闭的完整性与 Schema 缺陷之上。

## 决策

M3-R2 采用三段信任边界：

1. Compiler 负责治理输入到中立 IR；
2. Source Generator 只负责从已验证 IR 到确定性 UTF-8 文本；
3. Runtime 由未来独立 M3-R3 承担，M3-R2 不实现。

Generator 必须是纯内存、固定模板、固定模块 allow-list、固定排序和固定转义的 renderer。它不得接受任意源码片段，不得写入调用方路径，不得读取文件、环境变量或凭据，不得访问网络，不得启动 VM、外部进程、容器或 Kubernetes 资源，也不得执行输出。

Source identity 必须至少绑定：

```text
generatorId
generatorVersion
generatorConfigurationDigest
specDigest
bundleDigest
compilationEvidenceDigest
sourceFormatVersion
canonicalRenderingPolicy
```

生成时间、CI Run、Artifact ID、PR 编号、工作目录、主机、操作系统和 Node 安装路径不得进入 Source identity。

## R0 predecessor correction

R0 在引入任何 Source contract 前关闭：

- named function declaration executable-material bypass；
- Compilation Evidence digest 未绑定 `decision`/`safetyBoundary`；
- Assertion Schema 未使用 discriminated union。

这些修复属于 M3-R1 合同加固，不生成源码，也不扩大运行能力。

## 结果

后续 P1–P5 可以在可验证的 IR 与明确的 canonical rendering policy 上推进。代价是 M3-R2 不具备运行价值；任何执行、Secret 解析、目标网络访问或结果采集必须重新授权并进入 M3-R3。

```text
sourceGenerationStarted=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
```
