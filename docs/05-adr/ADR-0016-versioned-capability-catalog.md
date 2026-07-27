# ADR-0016：规划能力使用版本化、内容寻址的目录

- 状态：Accepted
- 日期：2026-07-27

## 背景

确定性 Planner 不能依赖进程中隐式注册的最新能力，也不能把执行器脚本混入 Test Intent。正式计划需要证明它使用了哪一组能力定义，并在目录变化后产生不同的规划 fingerprint。

## 决策

1. Capability 由 `capabilityId` 与严格 SemVer 共同标识；
2. Catalog 具有独立版本，并对规范化能力集合计算 SHA-256 digest；
3. 正式 Planning Request 同时绑定 Catalog version 与 digest；
4. 解析只接受精确 ID/version，不支持 `latest`、范围或隐式回退；
5. Catalog 按 ID/version 稳定排序，输入顺序不影响 digest；
6. 禁用能力、重复身份和 Target Kind 不兼容必须显式拒绝；
7. Capability 仅描述输入、断言、阈值、依赖和 Intent Kind 合同；
8. 执行器脚本、运行凭证、Worker、Queue、节点和 Kubernetes Job 配置不得进入 Catalog；
9. 核心不使用封闭能力枚举，基础能力标识只作为数据示例；
10. 所有 Adapter 通过同一 `CapabilityCatalogPort` 合同测试。

## 结果

优点：

- 计划可以精确追溯能力定义；
- Catalog 变化会确定性改变规划 fingerprint；
- Planner 不依赖运行时注册顺序；
- 后续执行器可以独立演进而不污染 Intent 合同。

代价：

- 目录更新需要显式版本演进；
- 旧计划需要保留对应 Catalog 快照或可验证内容；
- 能力合同需要保持 JSON 可规范化和执行器无关。
