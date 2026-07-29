# ADR-0026：以精确 main SHA 和 Registry digest 发布 GHCR 镜像

- 状态：Accepted
- 日期：2026-07-29

## 背景

Kubernetes Deployment 当前仍引用可变镜像标签。标签可以被重新指向，不能作为生产晋级的不可变证据。本地 Docker Image ID 只描述本地内容存储对象，也不能证明镜像已经进入外部 Registry。

R0 已通过真实 `main` push run 和永久 Artifact digest 关闭 main-CI blocker。R1-A 需要在不自动部署生产环境的前提下，从包含发布基础设施的精确 `main` 提交获得真实 GHCR digest、SBOM 和可验证构建来源。

## 决策

新增仅支持手动触发的 `m2-release-image.yml`。

发布 Workflow：

- 检出调用者提供的精确 40 位 SHA；
- 验证该 SHA 位于 `main` 历史；
- 验证所选提交包含 R0 closure、全部发布 Validator 和本 Workflow；
- 在推送前执行完整发布回归；
- 使用 GitHub 运行时 Token 写入 GHCR；
- 使用 Buildx 推送识别标签，但只把 `@sha256:` 引用写入证据；
- 重新拉取不可变引用并验证 RepoDigest；
- 生成 SPDX JSON SBOM；
- 使用 GitHub OIDC 生成 provenance 与 SBOM attestation；
- 输出独立 `m2-release-image-evidence/v1` Artifact。

R1-A 不把发布 source SHA 自动写入 Production Promotion。R1-B 必须将实际发布 source SHA、该提交的最终 main-CI 证据、Registry digest、SBOM、Attestation 和 Deployment manifest 一次性绑定，避免镜像来源与晋级记录漂移。

Workflow 申请最小必要权限：`contents:read`、`packages:write`、`id-token:write`、`attestations:write`。不使用长期 Registry Token、私钥或生产 Secret。

## 结果

- 标签只用于人工识别，不能关闭 Registry blocker；
- 只有真实 Registry digest 和完整 Artifact 才能作为 R1-B 输入；
- Packages 或 Attestation 权限不足会导致安全失败；
- Workflow 失败不会修改 Deployment 或 Production Promotion 记录；
- R1-B、生产部署和其余外部审批继续保持独立授权边界。
