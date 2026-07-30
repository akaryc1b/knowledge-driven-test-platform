# M3-R0 Execution Contract Foundation 开发交接

## 当前主线

M2-RC1 已正式关闭，当前基线为：

```text
main@14cc48e35f8084a1c4baf3489daca7da1c21eab4
m2Rc1Closed=true
repositoryReleaseReady=true
m3PlanningReady=true
m3ImplementationStarted=false
```

## 当前允许切片：M3-R0

M3-R0 只允许：

- `@kdtp/execution-contract` 纯内存合同包；
- Adapter Descriptor、Request、Failure、Result、Evidence；
- 确定性 ID、digest、幂等键和状态机；
- FROZEN Test Plan、Knowledge Snapshot、环境摘要和 Artifact digest 绑定；
- capability allow-list；
- 敏感信息、占位值、可变引用、脚本和未授权能力拒绝；
- JSON Schema、示例、Validator、Node tests 和永久 Workflow Artifact。

## 当前决策

```text
contractFoundationReady=<由 M3-R0 CI 决定>
executionImplementationStarted=false
nextRequiredSlice=M3-R1
```

## 冻结边界

M3-R0 不得启动执行器实现，不得调用 k6/xk6/Playwright，不得运行外部进程，不得创建 Worker、Queue、Scheduler、Kubernetes Job，不得访问 Secret、目标环境或网络端点，也不得增加远程执行 API、真实结果采集和 Allure。

任何非合同型执行能力必须在 M3-R0 使用普通 Merge Commit 合并，并完成精确 main 验证后，另开独立安全切片。
