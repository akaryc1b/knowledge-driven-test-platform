# Monorepo 结构

```text
knowledge-driven-test-platform/
├── apps/
│   ├── knowledge-cli/
│   ├── test-plan-cli/
│   └── read-only-governance-service/
├── packages/
│   ├── knowledge-core/
│   ├── knowledge-registry/
│   ├── knowledge-registry-postgres/
│   ├── knowledge-governance/
│   ├── knowledge-governance-postgres/
│   ├── governance-query/
│   ├── project-membership/
│   ├── project-membership-postgres/
│   ├── governance-http/
│   ├── governance-auth-oidc/
│   ├── test-plan/
│   ├── test-capability/
│   ├── test-planner/
│   ├── test-plan-registry/
│   ├── test-plan-postgres/
│   ├── test-plan-governance/
│   └── test-planning-orchestration/
├── schemas/
│   ├── knowledge/
│   ├── registry/
│   ├── governance/
│   ├── query/
│   ├── access/
│   ├── authentication/
│   ├── operations/
│   ├── deployment/
│   ├── planning/
│   └── capability/
├── deploy/
│   ├── postgres/
│   └── kubernetes/read-only-governance-service/
├── examples/
├── docs/
├── scripts/
└── .github/workflows/
```

## 依赖方向

```text
Kubernetes manifests
  → read-only-governance-service container contract

read-only-governance-service
  → governance-auth-oidc
  → governance-http
  → governance-query
  → knowledge-registry-postgres
  → knowledge-governance-postgres
  → project-membership-postgres
  → pg
```

应用组合根可以读取环境变量、创建 Pool、执行 migrations、监听端口和处理进程信号。Package 不得反向依赖应用或部署层。

## M2-A 新增结构

```text
packages/test-plan/
├── src/
├── test/
└── README.md

schemas/planning/
├── schema-catalog.json
└── v1/
```

`test-plan` 只依赖知识核心与治理快照合同；它不依赖数据库、HTTP、执行器或应用组合根。

## M1-J 新增结构

```text
deploy/kubernetes/read-only-governance-service/
├── serviceaccount.yaml
├── configmap.yaml
├── secret.example.yaml
├── deployment.yaml
├── service.yaml
├── pdb.yaml
├── kustomization.yaml
└── README.md

schemas/deployment/
scripts/validate-kubernetes-manifests.js
examples/read-only-deployment-acceptance.js
```

## 部署约束

- Manifest 使用 JSON-compatible YAML；
- 默认 Kustomization 不应用示例 Secret；
- ClusterIP Service 不创建外部入口；
- 生产镜像由晋级流程替换为不可变 digest；
- Kubernetes termination grace 必须覆盖应用关闭时间；
- `/live` 与 `/ready` 保持不同依赖语义；
- 故障验收测试属于应用测试，不依赖真实集群。

## 后续演进

```text
release-candidates/
packages/test-capability/
packages/test-planner/
packages/test-plan-registry/
packages/test-plan-postgres/
packages/k6-adapter/
packages/evidence-model/
apps/quality-console/
```

## M2-B 新增结构

```text
packages/test-capability/
schemas/capability/
examples/capability-catalog.js
```

Capability Catalog 是规划输入，不包含执行器实现。目录版本和 digest 必须共同绑定，所有解析使用精确 capability ID/version。

## M2-C 新增结构

```text
packages/test-planner/
examples/deterministic-test-plan.js
```

Planner 只依赖 `test-plan`、`test-capability` 和纯领域合同；不得依赖 PostgreSQL、HTTP、执行器或应用组合根。


## M2-D 新增结构

```text
packages/test-plan-registry/
packages/test-plan-postgres/
├── migrations/0001_create_test_plan_registry.sql
├── src/
└── test/
```

`test-plan-registry` 定义执行器无关的耐久计划生命周期与共享 Adapter Contract；`test-plan-postgres` 只负责 PostgreSQL 事务、锁、唯一约束、checksum migration 和追加式证据。规划逻辑仍由 `test-planner` 提供。


## M2-E 与 M2-F 新增结构

```text
packages/test-plan-governance/
packages/test-planning-orchestration/
apps/test-plan-cli/
examples/planning-orchestration.js
examples/postgres-planning-orchestration.js
```

治理包只定义授权、职责分离和 Gate；Orchestration 包负责有界 PostgreSQL Unit of Work。CLI 只调用应用服务，不复制 Planner 或治理逻辑。
