# M3-R1 k6 API Spec Compiler

## 交付

- 纯内存 `@kdtp/k6-api-adapter`；
- 七项 versioned IR Schema 与一项验收 Evidence Schema；
- FROZEN Plan、Snapshot、Request、Adapter、Environment 和 Capability digest 绑定；
- Spec、Bundle、Compilation Evidence 确定性 ID 与 digest；
- Secret、placeholder、mutable reference、脚本、网络和绝对路径拒绝；
- Focused tests、根回归、Repository Validator、Dedicated Workflow 和永久 Artifact。

## 不包含

不调用 k6/xk6/Playwright，不生成可运行 JavaScript，不运行外部进程，不访问目标网络、Secret、数据库或凭据文件，不创建执行目录、容器、Worker、Queue、Scheduler 或 Kubernetes 资源。

```text
apiAdapterCompilerReady=true
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
nextRequiredSlice=M3-R2
repositoryBlockers=[]
```
