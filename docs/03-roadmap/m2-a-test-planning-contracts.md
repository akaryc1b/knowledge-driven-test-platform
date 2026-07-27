# M2-A — Test Planning Contracts and Identity

## 目标

建立执行器无关、版本化、可规范化和可确定性寻址的测试规划核心模型。本切片不接入 PostgreSQL，不开放 HTTP 写接口，也不实现测试执行器。

## 计划结构

新增：

```text
packages/test-plan/
schemas/planning/
```

版本化合同：

- `test-planning-request/v1`；
- `test-target-inventory/v1`；
- `test-intent/v1`；
- `test-coverage-obligation/v1`；
- `test-plan/v1`。

规划请求固定绑定：

- project、environment、release；
- immutable knowledge snapshot ID 与 digest；
- planner version；
- capability catalog version 与 digest；
- Target Inventory；
- Planning Policy。

测试计划至少包含 identity、revision、status、snapshot、planner、catalog、targets、intents、coverage、provenance、createdAt 和 createdBy。

## 身份与规范化

- `planId` 由规范化规划输入的 SHA-256 确定性派生；
- 建议格式为 `tp-{projectId}-{digestPrefix}`；
- `intentId` 由计划输入、目标、能力和来源知识确定性派生；
- 所有 digest 使用小写十六进制 SHA-256；
- canonical JSON 复用 M0/M1 的无依赖核心实现；
- 数组在进入 digest 前按合同规定稳定排序；
- 所有构造器和 Adapter 边界必须 defensive copy。

## 安全边界

计划和规划请求拒绝：

- password、token、secret、privateKey、connectionString 等敏感字段；
- 非 `PUBLISHED` 来源知识；
- 缺少 snapshot ID 或 digest 的隐式“最新知识”引用；
- 特定执行器脚本、运行节点和真实凭证；
- 随机 UUID、当前时间或对象插入顺序参与正式身份计算。

## 稳定错误

错误使用 `TestPlanError` 与稳定错误码，至少区分：

- `INVALID_PLANNING_REQUEST`；
- `INVALID_TARGET_INVENTORY`；
- `INVALID_TEST_INTENT`；
- `INVALID_COVERAGE_OBLIGATION`；
- `INVALID_TEST_PLAN`；
- `UNPUBLISHED_KNOWLEDGE`；
- `SNAPSHOT_BINDING_MISMATCH`；
- `SENSITIVE_PLANNING_DATA`；
- `NON_DETERMINISTIC_IDENTITY`。

## 验收

1. 相同输入在不同对象键顺序下产生同一 canonical JSON、digest 和 `planId`；
2. 任一绑定字段变化都会改变 fingerprint；
3. Test Intent 不允许脚本和 Secret；
4. 输入在调用后被修改不会改变已创建对象；
5. 所有五个 Schema 与运行时模型一致；
6. M1 全量测试和 Release Validator 保持通过。

## 明确不包含

- Capability Catalog 实现；
- Planner、Coverage Matrix、Provenance DAG；
- PostgreSQL；
- 审核、批准和冻结流程；
- HTTP API；
- 测试执行、Worker、Queue 或 M3。
