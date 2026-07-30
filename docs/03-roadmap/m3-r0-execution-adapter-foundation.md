# M3-R0 — Execution Adapter Foundation

## 状态

当前独立安全切片：**Contract-only 实现与验收**。

M2-RC1 已在 `main@14cc48e35f8084a1c4baf3489daca7da1c21eab4` 正式关闭。M3 执行实现尚未开始，本切片只建立后续 Adapter 必须遵守的确定性合同。

## Contract-only 目标

M3-R0 建立：

1. `ExecutionAdapterDescriptor`：固定 Adapter type、version、能力白名单、意图类型和输出 Artifact 类型；
2. `ExecutionRequest`：绑定项目、不可变环境摘要、已冻结 Test Plan、Knowledge Snapshot、固定 Adapter descriptor 和不可变输入 Artifact；
3. `ExecutionFailure`：固定错误分类、错误码、重试属性和脱敏详情；
4. `ExecutionResult`：固定终态、状态历史、失败/取消互斥规则、不可变输出 Artifact 和通用 measurement；
5. `ExecutionEvidence`：交叉绑定 Request、Result、Adapter、Test Plan、Knowledge Snapshot、环境和 Artifact digest；
6. 确定性 Adapter/Request/Result/Evidence ID 与 canonical SHA-256 digest；
7. 状态机、错误分类、取消语义、幂等键和 capability allow-list；
8. JSON Schema、本地 Validator、纯内存测试和永久 CI Artifact。

## 当前合同决策

```text
contractFoundationReady=true
executionImplementationStarted=false
nextRequiredSlice=M3-R1
repositoryBlockers=[]
```

`M3-R1` 只能是新的独立安全切片，并且仍应优先实现**非执行型 Adapter 编译/映射层**，不得在同一 PR 中引入 Worker 或远程执行。

## 不可变绑定规则

每个 `ExecutionRequest` 必须绑定：

- `projectId`；
- 版本化环境引用与 SHA-256 digest，不保存端点或凭据；
- `status=FROZEN` 的 Test Plan、revision、digest 与 input fingerprint；
- Knowledge Snapshot ID 与 digest；
- Adapter ID、type、version 与 descriptor digest；
- capability ID + exact SemVer；
- `artifact://sha256/<digest>` 输入引用；
- 显式资源上限与调用方提供的 SHA-256 idempotency key。

`latest`、`main`、占位值、可变 URI、未授权 capability、非冻结 Test Plan 或 digest 不匹配必须被拒绝。

## 状态与取消合同

允许的主路径：

```text
PENDING → VALIDATED → RUNNING → SUCCEEDED|FAILED|TIMED_OUT
PENDING → REJECTED
RUNNING → CANCELLATION_REQUESTED → CANCELLED|FAILED|TIMED_OUT
```

终态不可再次迁移。`CANCELLED` 仅适用于 `cancellationMode=COOPERATIVE`，并必须提供 requested/effective 时间、申请人和原因；`FAILED`/`TIMED_OUT` 必须绑定 `ExecutionFailure`。

## 明确禁止

本切片：

- 不调用 k6、xk6、Playwright 或任何测试二进制；
- 不导入或调用 `child_process`、`spawn`、`exec` 或 shell；
- 不创建 Worker、Queue、Scheduler、Kubernetes Job 或执行 Pod；
- 不访问目标环境、网络端点、Secret 或凭据；
- 不收集真实测试结果，不生成 Allure；
- 不增加远程执行 API；
- 不改变 M2-RC1 镜像或发布证据。

## 退出条件

M3-R0 只有在以下内容全部成功后，才允许进入 M3-R1：

- 五项核心 Schema 与 Evidence Schema；
- 确定性 Validator 和拒绝测试；
- `npm test` 与 `npm run validate`；
- 独立 GitHub Actions Workflow；
- 永久 `m3-r0-execution-contract-evidence` Artifact；
- 合并后精确 main push 验证。
