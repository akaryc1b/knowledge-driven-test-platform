# M2-RC1 Immutable GHCR Image Release

## 目标

R1-A 为已经完成 R0 Production Promotion Contract 和 main-CI closure 的精确 `main` 提交建立受控、不可变的 GHCR 镜像发布流水线。

本切片只发布现有 `read-only-governance-service` 镜像，不增加产品功能，不部署到目标集群，也不提前修改 Production Promotion 或 Deployment 中的 Registry 证据。

## 触发契约

`.github/workflows/m2-release-image.yml` 只接受 `workflow_dispatch`，并要求显式输入：

- `source_sha`；
- `release_id`，必须为 `M2-RC1`；
- `version`，必须为 `0.12.0`。

Workflow 必须验证：

1. `source_sha` 是合法 40 位 Git SHA；
2. `source_sha` 位于 `main` 历史中；
3. 检出的提交精确等于输入 SHA；
4. 所选提交包含 Production Promotion、R0 closure、全部 Validator、证据生成器和本发布 Workflow；
5. 输入 release/version 与 Production Promotion 一致。

R1-B 必须将真实发布 source SHA、其最终 main-CI 证据和 Registry digest 重新绑定到 Production Promotion，不得保留与镜像来源不一致的旧 source SHA。

## 权限边界

Workflow 仅申请：

- `contents: read`；
- `packages: write`；
- `id-token: write`；
- `attestations: write`。

GHCR 登录使用运行时 `GITHUB_TOKEN`，不得使用或上传长期 Registry Token。Attestation 使用 GitHub OIDC，不得提交私钥。

## 发布前验收

推送前必须完成：

- `npm ci --ignore-scripts`；
- 全量 Node 测试；
- Repository Validator；
- Deployment Validator；
- M1、M2 Candidate、M2 Post-Merge、Production Promotion、main-CI observation 与 R0 closure Validator；
- PostgreSQL 18 集成测试；
- 所有非 PostgreSQL 与 PostgreSQL examples；
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

但发布证据只使用完整不可变引用：

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

## 实际发布结果

最终成功发布：

- source：`main@6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7`；
- main push Validation run：`30440545497`；
- release run：`30440674461`；
- release evidence Artifact：`8719335176`；
- Artifact digest：`sha256:03d7a7aa35b99436237494dae1f1048b828812651e4b39b4c8c82ea41a6aeef5`。

不可变镜像：

```text
ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13
```

其他证据：

- pull verification：`PASSED`；
- SPDX JSON SBOM：`sha256:94a4a77a76f4802c9ff4a238e63854e1619d2ce46fd6a5eaef1e2698eb033702`；
- provenance attestation：`37705043`；
- provenance bundle：`sha256:9713617e86d763075dff8e5b1394a1c7a97c0f8ef4d05a2310670daa5d90b6be`；
- SBOM attestation：`37705058`；
- SBOM bundle：`sha256:0191ec23424d1e0128ded4a3a57dc2f489b6ab07629210d84de27e008d5cdc84`。

前两次发布分别在 release source branch 与 `DATABASE_URL` 环境契约处安全失败，均发生在 GHCR 写入前；失败记录保留，未产生虚假 digest。

## R1-A / R1-B 边界

R1-A 只产生真实外部发布证据。

R1-B 负责：

- 把 release evidence 保存为仓库证据；
- 把 Promotion source/main CI 更新为真实镜像来源；
- 把 imageRelease 更新为 `PUBLISHED`；
- 把 Deployment 更新为相同的 `@sha256:` 引用；
- 关闭 `external-registry-digest-missing`；
- 保持 Secret、cluster 和审批 blocker 开放。

## 明确不在范围内

- 自动生产部署；
- Secret 配置；
- 目标集群资源创建；
- Change/Release Owner 审批；
- M2-J、M3、Worker、Queue、Scheduler、Kubernetes Job、Allure、k6/xk6 或 Playwright。
