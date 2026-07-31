# M3-R0 Execution Contract Foundation

## 目标

在不启动真实执行的前提下，为 k6/xk6/Browser/WebSocket Adapter 建立统一、确定性、可审计的合同边界。

## 交付

- `@kdtp/execution-contract`；
- Adapter Descriptor、Request、Failure、Result、Evidence；
- 六项 JSON Schema 与 Schema Catalog；
- 状态机、错误分类、取消和幂等合同；
- 敏感信息、占位值、可变 Artifact 和可执行材料拒绝；
- 独立 Validator、示例、测试和永久 Workflow Artifact。

## 决策

```text
contractFoundationReady=true
executionImplementationStarted=false
nextRequiredSlice=M3-R1
repositoryBlockers=[]
```

## 不包含

不调用 k6/xk6/Playwright，不使用外部进程，不访问网络、Secret 或目标环境，不创建 Worker/Queue/Scheduler/Kubernetes Job，不增加远程执行 API、结果采集或 Allure。
