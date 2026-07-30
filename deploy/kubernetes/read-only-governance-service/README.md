# Read-Only Governance Service Kubernetes Template

此目录是 **Provider-agnostic 部署模板**，不是某个生产环境的完整配置。所有 `.yaml` 文件保持 JSON-compatible YAML，既可由 Kubernetes/Kustomize 读取，也可由仓库 Node Validator 确定性解析。

## 固定发布内容

Deployment 已绑定不可变 GHCR 镜像：

```text
ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13
```

模板保留：

- 2 个副本与 RollingUpdate `maxUnavailable=0`；
- Startup、Liveness 和 Readiness Probe；
- 非 Root 与只读 Root Filesystem；
- `RuntimeDefault` seccomp；
- `capabilities.drop=ALL`；
- `allowPrivilegeEscalation=false`；
- `automountServiceAccountToken=false`；
- PDB、资源限制和终止宽限期。

## 必需 Runtime Inputs

| 变量 | 来源建议 | 说明 |
|---|---|---|
| `KDTP_DATABASE_URL` | Secret、External Provider 或 Identity Adapter | 不得提交真实连接串 |
| `KDTP_OIDC_ISSUER` | ConfigMap Overlay | 必须替换 `.invalid` 模板 |
| `KDTP_OIDC_JWKS_URI` | ConfigMap Overlay | 必须替换 `.invalid` 模板 |
| `KDTP_OIDC_AUDIENCE` | ConfigMap Overlay | 按部署方 OIDC Client 配置 |
| `KDTP_OIDC_SUBJECT_MAPPINGS_JSON` | Secret 或受控 Overlay | 不得提交真实生产映射 |

## Secret Delivery

Deployment 引用稳定名称：

```text
kdtp-read-only-governance-secrets
```

该名称只定义应用输入边界，不规定 Secret 的来源。部署方可以使用：

- 原生 Kubernetes Secret；
- External Secrets Operator；
- Secrets Store CSI Driver；
- AWS、Azure、GCP 或 Vault；
- Workload Identity；
- 其他组织批准的安全交付方式。

`secret.example.yaml` 只描述键合同，不在 `kustomization.yaml` 中，禁止写入真实值或直接作为生产 Secret 使用。仓库不要求 Provider metadata，也不保存 Secret 值。

## 部署方必须完成

1. 创建 Overlay 并替换 OIDC `.invalid` 地址；
2. 提供数据库身份和 Subject Mapping；
3. 在目标环境验证 Network、DNS、PostgreSQL、OIDC 和 Admission Policy；
4. 按本组织要求完成审批；
5. 再执行部署或流量切换。

这些步骤属于具体部署实例，不影响通用仓库的 `repositoryReleaseReady`。

## 仓库验证

```bash
npm run validate:deployment
npm run validate:m2-portable-release-readiness
```

仓库验证不会访问目标集群、读取 Secret 或执行 rollout。
