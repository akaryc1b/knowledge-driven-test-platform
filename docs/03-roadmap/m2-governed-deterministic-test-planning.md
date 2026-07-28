# M2 — Governed Deterministic Test Planning

## 目标

M2 将 M1 已发布并形成不可变快照的知识转换为可审查、可冻结、可复现的执行器无关测试计划。

```text
PUBLISHED Knowledge
        ↓
Immutable Knowledge Snapshot
        ↓
Target Inventory
        ↓
Capability Catalog
        ↓
Deterministic Planner
        ↓
Test Intents + Coverage + Provenance
        ↓
Review and Approval
        ↓
FROZEN Test Plan
```

M2 只负责规划，不执行测试。后续执行阶段只能消费 `FROZEN` 计划。

## 分批推进

### 第一批：规划核心

- M2-A：Test Planning Contracts and Identity；
- M2-B：Versioned Capability Catalog；
- M2-C：Deterministic Planner and Coverage。

### 第二批：持久化与治理

- M2-D：Durable Test Plan Registry；
- M2-E：Plan Governance and Review；
- M2-F：Durable Planning Orchestration。

### 第三批：查询、服务与验收

- M2-G：Read-Only Plan Query API；
- M2-H：Planning Service Composition and Operations；
- M2-I：M2 Release Acceptance。

## 全局约束

1. 只消费 `PUBLISHED` Knowledge 与不可变 Snapshot Envelope；
2. Snapshot ID 与 SHA-256 digest 必须同时绑定；
3. Capability Catalog 必须版本化并固定 digest；
4. Planner、ID、排序、Coverage 和 Provenance 必须确定性；
5. Test Intent 必须执行器无关，不包含脚本或运行凭证；
6. DAG 必须无环并使用稳定拓扑排序；
7. FROZEN 计划不可修改；
8. AI 只能提供建议，不能生成、批准或冻结正式结果；
9. Secret、Token、私钥和数据库连接串不得进入计划或证据；
10. M1 查询、认证、授权、运维与发布候选必须持续回归。

## 明确冻结范围

M2 不实现 k6、xk6、Playwright、Worker、Queue、Scheduler、Kubernetes Job、测试执行、结果采集、Allure、生产部署或 M3 功能。
