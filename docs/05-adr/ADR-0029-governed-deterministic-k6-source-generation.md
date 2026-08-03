# ADR-0029：受治理的确定性 k6 Source Generation 边界

## 状态

Accepted for M3-R2-P1 Contract Foundation.

## 背景

M3-R1 已将 FROZEN Test Plan 编译为中立、不可执行的 `K6ApiExecutionSpec`。M3-R2-R0 随后关闭 PR #44 合并后的三个合同缺陷，并冻结 Source Generation 与 Runtime 的隔离边界。P1 需要在不生成 JavaScript 的前提下，把未来 renderer 可接受的输入、固定配置、身份绑定和资源上限发布为 versioned contract。

## 决策

M3-R2 继续采用三段信任边界：

1. Compiler 负责治理输入到中立 IR；
2. Source Contract 负责固定未来 Generator 的合法配置和请求；
3. Source Generator 从 P2 才可实现纯内存确定性 rendering；
4. Runtime 由未来独立 M3-R3 承担，M3-R2 不实现。

P1 在现有 `@kdtp/k6-api-adapter` 包内增加合同层，而不创建 Generator 包。P1 发布：

- `K6ApiSourceRenderingPolicy`；
- `K6ApiSourceGeneratorDescriptor`；
- `K6ApiSourceGenerationRequest`；
- 对应 Draft 2020-12 Schema Catalog、Validator、测试、示例和永久 CI 证据。

Descriptor 的 `implementationStatus` 固定为 `CONTRACT_ONLY`。允许模块固定为精确的 `k6` 与 `k6/http`，不支持 wildcard、动态模块、调用方模板或任意源码。

## Canonical Rendering Policy

P1 固定未来 renderer 必须遵守的策略：

```text
encoding=UTF-8
bom=false
lineEnding=LF
indentationSpaces=2
quoteStyle=SINGLE
trailingNewline=true
objectKeyOrdering=LEXICOGRAPHIC
moduleOrdering=LEXICOGRAPHIC
groupOrdering=GROUP_ID
operationOrdering=DEPENDENCY_THEN_OPERATION_ID
assertionOrdering=KIND_PATH_EXPECTED
thresholdOrdering=METRIC_OPERATOR_VALUE
variableNameDerivation=IMMUTABLE_ID_SHA256_12
```

P1 只定义策略，不执行 rendering。

## Identity 决策

Future Source identity 必须绑定：

```text
generatorId
generatorVersion
generatorConfigurationDigest
specDigest
bundleDigest
compilationEvidenceDigest
sourceFormatVersion
canonicalRenderingPolicyDigest
allowedModulesDigest
```

以下元数据明确排除在 Source identity 外：

```text
requestedAt
requestedBy
generatedAt
prNumber
ciRunId
artifactId
workingDirectory
host
operatingSystem
```

请求元数据仍进入 Source Generation Request envelope digest，因此审计信息变化不会改变未来 Source identity，但会改变 request digest。

## Binding 与资源上限

P1 Request 必须独立复核：

- Spec、Bundle 和 Compilation Evidence 的版本与 digest；
- Bundle 到 Spec、Evidence 到 Spec/Bundle 的精确绑定；
- Compiler 版本、input contract、Test Plan、Knowledge Snapshot、Environment 和 capability 绑定；
- M3-R1 非执行 decision 与全部安全声明；
- operation、group、assertion、threshold、Artifact、string、depth 与 serialized-byte 上限。

任何未知字段、可执行源码、网络 URL、绝对路径、凭据、Secret、module escalation、policy drift、limit drift 或 `IMPLEMENTED` 状态都 fail closed。

## 结果

P1 建立了 P2 可消费的严格合同，但没有 renderer、source bytes、source Artifact、静态 parser 或 Runtime。P2 必须在独立安全切片中实现，且整个 M3-R2 继续禁止执行生成结果。

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
