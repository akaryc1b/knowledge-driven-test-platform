# M2-D 当前开发交接

## 第一批已完成

- M2-A：版本化 Test Planning 合同、确定性身份、canonical JSON 和 Secret/脚本拒绝；
- M2-B：版本化 Capability Catalog、精确解析、兼容性和 Catalog digest；
- M2-C：确定性 Planner、Coverage Matrix、Provenance Graph、Dependency DAG 和稳定 result digest；
- 三个 Draft PR 均通过 Node、Docker、M1 Release 与 PostgreSQL 18 CI；
- M1-RC1 未被覆盖，仍保持 `productionEligible=false`。

## M2-D 允许

- `packages/test-plan-postgres/`；
- Durable Test Plan Registry Port/Adapter；
- DRAFT、REVIEWING、APPROVED、FROZEN、SUPERSEDED、ARCHIVED 生命周期原语；
- revision CAS、行锁和唯一约束；
- append-only history 与 review decision 结构；
- checksum migration、幂等、回滚和 restart recovery；
- FROZEN 内容与 Snapshot/Catalog binding 防篡改；
- PostgreSQL 18 并发集成测试。

## M2-D 不允许

- 审批角色映射或职责分离策略；
- Coverage Approval/Freeze Gate；
- HTTP 写路由；
- k6、xk6、Playwright、Worker、Queue、Scheduler、Kubernetes Job、结果采集或 M3。

## 同批次后续

M2-D 通过后自动继续：

```text
M2-E Plan Governance and Review
  ↓
M2-F Durable Planning Orchestration
```

只有第二批全部完成后统一汇报。
