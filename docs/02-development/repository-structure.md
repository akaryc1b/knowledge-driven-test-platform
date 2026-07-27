# Monorepo 结构

```text
knowledge-driven-test-platform/
├── apps/
│   ├── knowledge-cli/
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
│   └── governance-auth-oidc/
├── schemas/
│   ├── knowledge/
│   ├── registry/
│   ├── governance/
│   ├── query/
│   ├── access/
│   ├── authentication/
│   ├── operations/
│   └── deployment/
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
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/quality-console/
```
