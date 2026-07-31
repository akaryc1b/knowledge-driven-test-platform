# M3-R1 k6 API Spec Compiler Acceptance Matrix

| ID | 控制 | 验收条件 |
|---|---|---|
| KC-01 | M3-R0 binding | 精确绑定已接受 Merge SHA、Run 和 Artifact |
| KC-02 | Adapter gate | 仅接受 `adapterType=k6-api` 和固定版本 |
| KC-03 | FROZEN gate | 非 FROZEN Test Plan 拒绝 |
| KC-04 | Context binding | project、environment、plan、snapshot 任一错绑即拒绝 |
| KC-05 | Capability subset | 计划能力必须同时在 Descriptor 和 Request allow-list 中 |
| KC-06 | Explicit mapping | method、path template、assertion、threshold 明确存在 |
| KC-07 | Determinism | 重复生成、字段顺序与数组顺序扰动结果一致 |
| KC-08 | Immutable Artifact | 仅接受 `artifact://sha256/<digest>` 且 digest 匹配 |
| KC-09 | Sensitive rejection | Secret、Token、Authorization、Cookie、连接串和私钥拒绝 |
| KC-10 | Executable rejection | script、command、JavaScript、shell、绝对路径拒绝 |
| KC-11 | Non-execution | 不调用 k6/xk6/Playwright，不运行外部进程，不访问网络 |
| KC-12 | Permanent evidence | General、Dedicated、Repository Validator 和 Artifact 成功 |

```text
apiAdapterCompilerReady=true
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
nextRequiredSlice=M3-R2
repositoryBlockers=[]
```
