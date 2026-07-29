# ADR-0026：以精确源码 SHA 和 Registry digest 发布 GHCR 镜像

- 状态：Accepted
- 日期：2026-07-28

## 背景

Kubernetes Deployment 当前仍引用可变镜像标签。标签可以被重新指向，不能作为生产晋级的不可变证据。本地 Docker Image ID 只描述本地内容存储对象，也不能证明镜像已经进入外部 Registry。

M2-RC1 需要在不自动部署生产环境的前提下，获得真实 GHCR digest、SBOM 和可验证的构建来源。

最终 `main@991b5f0f9cfa3a382f9aff3c600f98b76aed9c08` 的 push CI 已确认失败，并且该提交早于 R0/R1-A 发布基础设施。强制以该旧 SHA 发布会形成无法执行的循环依赖。

## 决策

新增仅支持手动触发的 `m2-release-image.yml`。

发布 Workflow：

- 检出调用者提供的精确 40 位 SHA；
- 验证该 SHA 位于 `main` 历史；
- 验证源提交包含 R0/R1-A 必要契约、Validator 与证据生成器；
- 在推送前执行完整发布回归；
- 使用 GitHub 运行时 Token 写入 GHCR；
- 使用 Buildx 推送识别标签，但只把 `@sha256:` 引用写入证据；
- 重新拉取不可变引用并验证 RepoDigest；
- 生成 SPDX JSON SBOM；
- 使用 GitHub OIDC 生成 provenance 与 SBOM attestation；
- 输出独立 `m2-release-image-evidence/v1` Artifact。

R1-A 的职责是证明某个精确、受治理且已进入 `main` 历史的源码 SHA 产生了真实不可变镜像。将该 source SHA、Registry digest、SBOM、Attestation 与 Production Promotion 及 Deployment 清单正式绑定，属于取得真实外部证据后的独立 R1-B。

Workflow 申请最小必要权限：`contents:read`、`packages:write`、`id-token:write`、`attestations:write`。不使用长期 Registry Token、私钥或生产 Secret。

## 结果

- 标签只用于人工识别，不能关闭 Registry blocker；
- 只有真实 Registry digest 和完整 Artifact 才能作为 R1-B 输入；
- Packages 或 Attestation 权限不足会导致安全失败；
- Workflow 失败不会修改 Deployment 或 Production Promotion 记录；
- R1-B、生产部署和其余外部审批继续保持独立授权边界。
