# M3-R0 — Execution Adapter Foundation

## 状态

M3 入口规划已开放，执行实现尚未开始。

## Contract-only 目标

M3-R0 只建立执行 Adapter 的确定性合同与安全边界：

1. Adapter identity、type、version 与 capability descriptor；
2. 不可变 Execution Request、Execution Result 和 Evidence envelope；
3. Test Plan Snapshot、environment reference 与 artifact reference 的绑定规则；
4. 状态机、错误分类、取消语义和幂等键；
5. 敏感信息、占位值、可变引用和未授权能力的拒绝规则；
6. JSON Schema、本地 Validator、纯内存测试和文档。

## 明确禁止

本切片：

- 不调用 k6、xk6、Playwright 或任何测试二进制；
- 不使用 `child_process`、`spawn`、`exec` 或 shell；
- 不创建 Worker、Queue、Scheduler、Kubernetes Job 或执行 Pod；
- 不访问目标环境、Secret、凭据或网络端点；
- 不收集真实测试结果，不生成 Allure；
- 不增加远程执行 API；
- 不改变 M2-RC1 镜像或发布证据。

## 首批合同建议

```text
ExecutionAdapterDescriptor
ExecutionRequest
ExecutionResult
ExecutionEvidence
ExecutionFailure
```

每个合同必须绑定：

- `projectId`；
- 已发布 Knowledge Snapshot；
- 已冻结 Test Plan；
- Adapter type/version；
- 不可变输入 digest；
- 确定性 request ID；
- 允许的 capability 集合。

## 退出条件

M3-R0 只有在 Schema、Validator、拒绝测试、Repository Validation 和永久 CI Artifact 全部成功后，才允许进入第一个非执行型 Adapter 实现切片。
