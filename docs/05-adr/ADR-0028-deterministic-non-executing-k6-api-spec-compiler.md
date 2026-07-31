# ADR-0028：以中立 IR 隔离 k6 API 编译与执行

## 状态

Accepted for M3-R1.

## 决策

在 M3-R0 不可变执行合同之上增加纯内存 `@kdtp/k6-api-adapter`。Compiler 将 FROZEN Test Plan intents 映射为 versioned k6 API 中立 IR，并计算 Spec、Bundle、Evidence 的确定性身份与 digest。

Compiler 不生成可运行 k6 JavaScript，不启动 runtime，不读取凭据，不访问网络或文件系统，不创建 Worker、Queue、Scheduler、容器或 Kubernetes 资源。真实 source generation 或 runtime boundary 必须在后续独立切片重新授权。

## 结果

映射规则、能力授权和全部输入 digest 在执行前固定，可独立测试、审计和缓存；代价是 M3-R1 本身没有执行能力。

```text
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
```
