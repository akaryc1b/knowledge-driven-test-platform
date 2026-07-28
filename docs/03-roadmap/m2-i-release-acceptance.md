# M2-I — M2 Release Acceptance

## 目标

将 M2-A～M2-H 的确定性规划、持久化、治理、只读查询和服务组合收敛为独立、可验证、可审计但尚未生产晋级的 `M2-RC1`。本切片不合并堆叠 PR，不覆盖或修改 M1-RC1 的历史证据。

## 候选范围

```text
M2-A Contracts and Identity
  ↓
M2-B Capability Catalog
  ↓
M2-C Deterministic Planner
  ↓
M2-D Durable Plan Registry
  ↓
M2-E Governance and Review
  ↓
M2-F Durable Orchestration
  ↓
M2-G Read-Only Plan Query API
  ↓
M2-H Service Composition and Operations
```

## 必须证据

- PR #12～#19 的 base/head SHA 与连续堆叠关系；
- Planning、Capability、Coverage、Provenance、DAG、Registry 和 Query schema digest；
- 完整 Node、PostgreSQL 18、Docker、Deployment 和 Release Validator 成功；
- Published Snapshot → Generate → Submit → Review → Approve → Freeze → Reload；
- PostgreSQL、JWKS、RS256 JWT、Membership 与十条只读业务路由端到端；
- 缺少 Token、跨项目访问、写方法和未知路由拒绝；
- PostgreSQL/JWKS 故障只撤销 readiness，恢复后无需重启；
- SIGTERM 排空请求并关闭 Pool；
- 证据不得包含 Token、私钥、数据库连接串、Subject Mapping 或执行脚本。

## 候选资格

`productionEligible` 固定为 `false`。阻断项至少包括：M2 堆叠 PR 尚未按顺序合并、缺少合并后 main CI、外部镜像不可变 digest、真实 Secret 管理引用、目标集群验证、变更审批与独立发布负责人签署。

## 明确不包含

- 自动合并、镜像推送或集群部署；
- 计划写入 HTTP API；
- k6/xk6、Playwright、Worker、Queue、Scheduler、Kubernetes Job；
- 测试执行、结果采集、Allure 或 M3。
