# M1-J — Read-Only Deployment Manifest and Fault Acceptance

## 目标

把 M1-I 的可启动只读服务提升为可审查的 Kubernetes 部署基线，并用确定性故障测试证明依赖中断、恢复和 Pod 终止不会破坏只读服务边界。

本切片不执行真实生产部署，不包含真实 Secret，也不创建外部流量入口。

## Kubernetes 资源

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
```

所有 `.yaml` 使用 JSON-compatible YAML。Kubernetes 可以直接读取，仓库也能使用 Node 原生 JSON 解析进行无第三方依赖校验。

## 工作负载基线

Deployment 固定以下最小约束：

- 2 个副本；
- `RollingUpdate`；
- `maxUnavailable: 0`；
- `maxSurge: 1`；
- `minReadySeconds: 10`；
- `revisionHistoryLimit: 3`；
- `terminationGracePeriodSeconds: 30`；
- 基于 hostname 的 topology spread；
- CPU/内存 requests 与 limits。

30 秒 Pod 终止宽限期必须至少比应用 10 秒关闭上限多 5 秒。

## 探针

| 类型 | 路径 | 语义 |
|---|---|---|
| startup | `/live` | 进程已能响应，不依赖 PostgreSQL/JWKS |
| liveness | `/live` | 事件循环仍可响应 |
| readiness | `/ready` | PostgreSQL 和 JWKS 当前可用 |

依赖故障只撤销 Readiness，不触发 Liveness 重启循环。依赖恢复后，Pod 无需重启即可重新进入 Ready。

## Pod 安全

- 独立 ServiceAccount；
- 禁止自动挂载 ServiceAccount Token；
- `runAsNonRoot: true`；
- 固定非 Root UID/GID；
- `RuntimeDefault` seccomp；
- `allowPrivilegeEscalation: false`；
- `readOnlyRootFilesystem: true`；
- Drop `ALL` Linux capabilities；
- 有界 `/tmp` `emptyDir`；
- ClusterIP Service，不创建 LoadBalancer 或 Ingress。

## 配置与 Secret

ConfigMap 只承载非敏感、环境相关参数。Secret 契约只包含：

- `KDTP_DATABASE_URL`；
- `KDTP_OIDC_SUBJECT_MAPPINGS_JSON`。

`secret.example.yaml` 使用明确的替换占位符，并故意不包含在默认 Kustomization 中。生产 Secret 必须由外部 Secret 管理流程创建。

OIDC issuer 与 JWKS URI 虽不属于密码，但必须在部署环境覆盖示例地址。

## 镜像策略

Manifest 禁止使用 `latest`。仓库基线提供版本标签以便审查，但生产晋级必须将其替换为已验证镜像 digest：

```text
image@sha256:<promoted-digest>
```

自动发布和镜像晋级不属于 M1-J。

## 可用性与中断

- PodDisruptionBudget：`minAvailable: 1`；
- 两副本滚动升级不允许主动下线现有可用 Pod；
- Service 仅选择匹配的 Ready Pods；
- SIGTERM 首先撤销 Readiness，再停止接收连接并排空活动请求。

## 故障验收

自动测试覆盖：

1. PostgreSQL 正常 → 故障 → 恢复；
2. JWKS 正常 → 故障 → 恢复；
3. 依赖故障时 `/live=200`、`/ready=503`；
4. SIGTERM 时已进入的请求正常完成；
5. 请求完成后再关闭 PostgreSQL Pool；
6. 无需重启即可恢复 Ready；
7. 启动 Readiness 失败时不留下监听器或 Pool。

错误正文、连接串和 JWKS 地址不会出现在探针响应中。

## 确定性校验

```bash
npm run validate:deployment
npm run example:deployment
```

校验器验证资源身份、标签、滚动更新、探针、安全上下文、资源限额、ConfigMap/Secret 引用、PDB 和 Kustomization 排除示例 Secret。

CI 还会在以下容器条件下执行 `node --version`：

- read-only root filesystem；
- `/tmp` tmpfs；
- Drop all capabilities；
- no-new-privileges。

## 明确不包含

- 真实生产 Secret；
- Ingress、Gateway 或公网暴露；
- Helm Chart；
- 集群自动部署；
- 写入 HTTP API；
- IdP、成员或 Subject Mapping 管理 API；
- k6 Worker、队列或生产测试执行。

## 验收标准

- Manifest 通过仓库确定性校验；
- 所有故障验收测试通过；
- Docker 镜像可在硬化运行参数下启动 Node；
- PostgreSQL/JWKS 故障不会影响 Liveness；
- 恢复后 Readiness 自动恢复；
- SIGTERM 不丢失已进入请求；
- 完整历史回归与 PostgreSQL 18 CI 通过。
