# M2-B — Versioned Capability Catalog

## 目标

建立规划阶段使用的执行器无关能力目录。能力目录只说明平台可以规划哪些 Test Intent，不包含执行器脚本、运行凭证、Worker、队列或节点信息。

## 新增结构

```text
packages/test-capability/
schemas/capability/
examples/capability-catalog.js
```

Capability 定义包含：

- `capabilityId` 与精确 `version`；
- `name`、`targetKinds` 与 `intentKind`；
- `inputContract`、`assertionContract` 与 `thresholdContract`；
- `dependencyRules`；
- `enabled`、`source` 与 `tags`。

核心代码不得把 `api-functional`、`api-performance`、`web-ui`、`websocket`、`database`、`middleware` 实现为封闭枚举。这些标识只作为基础目录示例。

## 端口与 Adapter

- `CapabilityCatalogPort` 定义按精确 ID/version 解析和读取目录快照的稳定边界；
- `InMemoryCapabilityCatalog` 实现共享合同；
- 所有输入和输出 defensive copy；
- 目录按 capability ID/version 稳定排序；
- 重复 ID/version 在构造时拒绝；
- 禁用能力在正式解析时拒绝；
- Target Kind 必须与能力声明兼容；
- 目录版本与 SHA-256 digest 同时绑定。

## 确定性与安全

目录 digest 只覆盖版本化、规范化的能力定义。对象键顺序和输入数组顺序不得影响 digest。能力合同拒绝：

- k6、Playwright、SQL、WebSocket 客户端等可执行脚本；
- password、token、secret、private key、connection string；
- Worker、Queue、Scheduler、Kubernetes Job 或运行节点配置；
- 非确定性 resolver、隐式 latest 版本或随机 ID。

## 验收

1. 相同能力集合在不同输入顺序下产生相同目录 digest；
2. 精确 ID/version 可稳定解析；
3. 缺失、禁用和 Target Kind 不兼容使用稳定错误码拒绝；
4. 重复能力在创建目录时拒绝；
5. 内存 Adapter 通过共享 Contract；
6. 正式 Test Planning Request 能绑定目录 version 与 digest；
7. M1 与 M2-A 全量回归继续通过。

## 明确不包含

- 实际执行器或脚本生成；
- Deterministic Planner；
- PostgreSQL；
- 计划审核、冻结或 HTTP 写接口；
- Worker、Queue、Scheduler、Kubernetes Job 或 M3。
