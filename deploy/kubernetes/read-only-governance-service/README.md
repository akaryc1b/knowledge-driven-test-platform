# Read-Only Governance Service Kubernetes Baseline

该目录提供 M1-J 的只读部署基线。所有 `.yaml` 文件使用 JSON-compatible YAML，既可由 Kubernetes/Kustomize 读取，也可由仓库 Node 校验器确定性解析。

## 部署前必须替换

- `deployment.yaml` 中的示例版本镜像必须替换为经过晋级的不可变 digest；
- `configmap.yaml` 中的 OIDC issuer、JWKS URI 和 audience；
- 通过外部 Secret 管理系统创建 `kdtp-read-only-governance-secrets`；
- Secret 必须包含 `KDTP_DATABASE_URL` 与 `KDTP_OIDC_SUBJECT_MAPPINGS_JSON`。

`secret.example.yaml` 只描述键契约，不在 `kustomization.yaml` 中，禁止直接用于生产。

## 安全基线

- 2 个副本，RollingUpdate `maxUnavailable=0`；
- Liveness `/live`、Readiness `/ready`、Startup `/live`；
- 非 Root、只读根文件系统、`RuntimeDefault` seccomp；
- 禁止提权，Drop 所有 Linux capabilities；
- 不挂载 ServiceAccount Token；
- 30 秒终止宽限期，高于应用 10 秒关闭上限；
- ClusterIP Service，不创建外部入口；
- PDB 保留至少 1 个可用副本。

## 验证

```bash
npm run validate:deployment
```

示例应用：

```bash
kubectl apply -f your-production-secret.yaml
kubectl apply -k deploy/kubernetes/read-only-governance-service
```
