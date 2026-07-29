# M2-RC1 Production Promotion Roadmap

## R0 — Production Promotion Contract

状态：本 PR 实施。

交付：

1. 独立 `PRODUCTION_PROMOTION` 记录与 v3 Schema；
2. 独立 evidence generator；
3. 本地确定性 Validator；
4. candidate 与 post-merge acceptance digest 不可变校验；
5. blocker 到证据字段的一一映射；
6. Node、PostgreSQL evidence、Repository Validator 和 CI Artifact；
7. 敏感信息与占位值拒绝测试。

R0 不发布镜像，不修改部署镜像引用，不关闭任何缺少真实外部证据的 blocker。

## R1-A — Immutable GHCR Image Release

状态：在独立堆叠 PR 中实施。

交付：

1. 仅由 `workflow_dispatch` 启动的受控发布 Workflow；
2. 验证输入 `source_sha` 位于 `main` 历史；
3. 检出精确 SHA并执行完整 Node、Repository、Deployment、M1/M2/Post-Merge/Production Promotion 与 PostgreSQL 18 验收；
4. 构建并推送 GHCR 镜像；
5. 输出真实 Registry digest；
6. 非 Root 与 hardened runtime 验证；
7. 生成 SPDX JSON SBOM；
8. 生成 provenance 与 SBOM attestation；
9. 拉取不可变引用并复核 digest；
10. 上传无敏感信息的镜像发布证据 Artifact。

如果 Packages、`packages: write`、`id-token: write`、`attestations: write` 或 GHCR 权限不足，Workflow 必须失败并保留 blocker。

## R1-B — Registry Digest Binding

状态：条件切片。

只有 R1-A 产生真实 Registry digest、SBOM digest、Attestation 标识和 pull verification 后才允许开始。

交付：

1. 将 Deployment 从可变标签绑定到完整 `@sha256:` 引用；
2. 将真实 build run、source SHA、SBOM、Attestation 和 manifest digest 追加到 Production Promotion 记录；
3. 仅在证据一致时关闭 `external-registry-digest-missing`；
4. 保持其余 Secret、Cluster 与审批 blocker 开放。

## 冻结范围

本 Roadmap 不启动 M2-J 或 M3，不增加执行型测试基础设施，不创建生产资源，也不合并任何 PR。
