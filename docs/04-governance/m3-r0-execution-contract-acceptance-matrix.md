# M3-R0 Execution Contract Acceptance Matrix

## A. 合同身份与不可变性

| ID | 控制 | 自动验证 | 通过条件 |
|---|---|---|---|
| EC-01 | Adapter identity | type/version/capabilities canonical digest | ID 与 digest 可重复生成 |
| EC-02 | Request identity | idempotency key + immutable bindings | request ID/digest 精确匹配 |
| EC-03 | Result identity | request、终态和输出绑定 | result ID/digest 精确匹配 |
| EC-04 | Evidence identity | Request/Result/Plan/Environment/Artifact 交叉绑定 | evidence ID/digest 精确匹配 |
| EC-05 | Schema Catalog | 六项 schema version/path | 全部固定且可解析 |

## B. 输入与能力安全

| ID | 控制 | 自动验证 | 通过条件 |
|---|---|---|---|
| EC-06 | Frozen Plan | `status=FROZEN` | 非冻结计划拒绝 |
| EC-07 | Context binding | project/environment/snapshot 一致 | 任一不一致拒绝 |
| EC-08 | Capability allow-list | exact ID + SemVer subset | 未授权能力拒绝 |
| EC-09 | Immutable Artifact | `artifact://sha256/<digest>` | 可变 URI 或 digest 不匹配拒绝 |
| EC-10 | Placeholder rejection | latest/main/.invalid/template markers | 全部拒绝 |
| EC-11 | Sensitive material | key/string pattern scan | Token、密码、私钥、带凭据 URI 拒绝 |
| EC-12 | Executable material | key/import/string scan | script/command/child process 拒绝 |

## C. 状态、错误与取消

| ID | 控制 | 自动验证 | 通过条件 |
|---|---|---|---|
| EC-13 | State transition | 固定 transition map | 非法跳转拒绝 |
| EC-14 | Terminal history | PENDING 开始、终态结束、时间单调 | 全部满足 |
| EC-15 | Failure semantics | FAILED/TIMED_OUT 绑定 failure | 缺失或分类错误拒绝 |
| EC-16 | Cancellation semantics | cooperative + request/effective metadata | 不完整取消拒绝 |
| EC-17 | Terminal immutability | 终态无后继 | 任何后续迁移拒绝 |

## D. 非执行安全边界

```text
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
networkEndpointAccessed=false
secretAccessed=false
workerAdded=false
queueAdded=false
schedulerAdded=false
kubernetesJobAdded=false
remoteExecutionApiAdded=false
resultCollectionImplemented=false
allureImplemented=false
```

## E. 最终决策

```text
contractFoundationReady=true
executionImplementationStarted=false
nextRequiredSlice=M3-R1
repositoryBlockers=[]
```
