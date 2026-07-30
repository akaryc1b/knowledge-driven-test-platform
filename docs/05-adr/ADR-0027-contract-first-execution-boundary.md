# ADR-0027：先建立不可变执行合同，再实现 Adapter

## 状态

Accepted for M3-R0.

## 背景

M2-RC1 已形成不可变 Knowledge Snapshot、FROZEN Test Plan 和可移植发布证据。直接引入 k6、Worker 或远程执行会同时扩大运行时、凭据、网络和调度边界，难以证明输入与结果的可追溯性。

## 决策

M3 首先建立独立 `@kdtp/execution-contract` 包：

- Adapter Descriptor 固定 type、version 和 capability allow-list；
- Request 只接受冻结计划、环境摘要和不可变 Artifact 引用；
- Result 使用固定终态、状态历史、失败和取消合同；
- Evidence 交叉绑定全部关键 digest；
- ID 和 digest 由 canonical JSON 确定性生成；
- Contract 层拒绝 Secret、占位值、可变引用和可执行材料。

M3-R0 不实现任何执行器，也不导入外部进程或网络运行时。

## 影响

优点：

- Adapter 实现可以替换，而 Request/Result/Evidence 保持稳定；
- 幂等、审计、取消和失败分类在执行前固定；
- 后续 Worker/Queue 不能绕过计划冻结和 capability 授权。

代价：

- 首个切片没有真实执行能力；
- 后续 Adapter 必须适配已发布合同，而不能随意输出私有结构。

## 后续

M3-R1 应优先实现纯转换的 Adapter 编译模型，不得与 Worker、Queue、Kubernetes Job 或远程执行 API 合并开发。
