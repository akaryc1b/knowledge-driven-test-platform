# M2-RC1 Immutable GHCR Image Release

## 目标

R1-A 为已经通过 R0 Production Promotion Contract 的精确 M2-RC1 主分支提交建立受控、不可变的 GHCR 镜像发布流水线。

本切片只发布现有 `read-only-governance-service` 镜像，不增加产品功能，不部署到目标集群，也不直接修改 Production Promotion 或 Deployment 中的外部 digest 绑定。

## 触发契约

`.github/workflows/m2-release-image.yml` 只接受 `workflow_dispatch`，并要求显式输入：

- `source_sha`；
- `release_id`，必须为 `M2-RC1`；
- `version`，必须为 `0.12.0`。

Workflow 必须验证：

1. `source_sha` 是合法 40 位 Git SHA；
2. `source_sha` 位于 `main` 历史中；
3. 检出的提交精确等于输入 SHA；
4. 输入 release/version 与源提交中的 `releases/m2/production-promotion.json` 一致；
5. 源提交实际包含 R0 Production Promotion Validator、main-CI evidence Validator 和 R1-A 镜像证据生成器。

R1-A 不要求 `source_sha` 等于尚未完成 digest binding 的 `promotionSource.mainSha`。该等值绑定只有在真实 GHCR digest、成功 build run、SBOM 与 Attestation 已存在后，才能由独立 R1-B 更新和验证。

已确认的 `main@991b5f0f9cfa3a382f9aff3c600f98b76aed9c08` push Run `30356400001` 失败，而且该提交不包含 R0/R1-A 发布基础设施。因此不得强制用该旧提交执行镜像发布，也不得把它的 PR Validation 当成成功的发布源验收。

## 权限边界

Workflow 仅申请：

- `contents: read`；
- `packages: write`；
- `id-token: write`；
- `attestations: write`。

GHCR 登录使用运行时 `GITHUB_TOKEN`，不得使用或上传长期 Registry Token。Attestation 使用 GitHub OIDC，不得提交私钥。

如果仓库或账户不允许 Packages 写入、OIDC 或 Artifact Attestation，Workflow 必须失败；不得生成假 digest 或把 blocker 标记为已解决。

## 发布验收

推送前必须完成：

- `npm ci --ignore-scripts`；
- 全量 Node 测试；
- Repository Validator；
- Deployment Validator；
- M1、M2 Candidate、M2 Post-Merge、Production Promotion 与 main-CI evidence Validator；
- PostgreSQL 18 集成测试；
- 现有非 PostgreSQL 与 PostgreSQL examples；
- Docker build；
- 容器 `USER node`；
- read-only root filesystem；
- `cap-drop=ALL`；
- `no-new-privileges`。

## 镜像与证据

允许推送识别标签：

- `0.12.0`；
- `m2-rc1`；
- `sha-<short-sha>`。

但证据只使用：

```text
ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:<registry-digest>
```

Workflow 必须：

- 校验 `docker/build-push-action` 输出的 Registry digest；
- 使用不可变引用重新拉取镜像；
- 验证拉取后的 RepoDigest 与输出 digest 一致；
- 对不可变镜像再次运行 hardened runtime；
- 生成 SPDX JSON SBOM；
- 生成 provenance attestation；
- 生成 SBOM attestation；
- 计算 SBOM 与 attestation bundle digest；
- 生成独立、无敏感信息的 `m2-release-image-evidence/v1` Artifact。

`m2-release-image-evidence/v1` 只声明这次镜像发布自身的事实。`eligibleForDigestBinding=true` 表示其证据可供 R1-B 消费，不代表 Production Promotion 已经完成，也不自动关闭任何其他 blocker。

## 安全失败

在真实 Workflow 成功完成之前：

- `external-registry-digest-missing` 保持开放；
- 不启动 R1-B；
- Deployment 保持原可变标签，不写入任何假 digest；
- `productionEligible` 保持 `false`。

## 明确不在范围内

- 自动生产部署；
- Secret 配置；
- 目标集群资源创建；
- Change/Release Owner 审批；
- M2-J、M3、Worker、Queue、Scheduler、Kubernetes Job、Allure、k6/xk6 或 Playwright。
