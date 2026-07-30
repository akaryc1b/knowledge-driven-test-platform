# M2-RC1 Production Promotion

## 目标

本阶段在不改写 M2 合并前候选与合并后验收记录的前提下，追加独立、可审计的生产晋级契约。

Production Promotion 只接受仓库内已经固定的证据。GitHub Actions、GHCR 和 Attestation 的真实结果必须先由受控 Workflow 产生，再通过 R1-B 绑定记录固化；不得由 Validator 猜测或补造。

## 不可变历史证据

- `releases/m2/planning-release-candidate.json`
  - canonical SHA-256：`5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697`
- `releases/m2/post-merge-acceptance.json`
  - canonical SHA-256：`d073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25`
- 原 R0 closure：`releases/m2/r0-main-ci-closure.json`
- 历史失败观测：`releases/m2/main-branch-ci-observation.json`

以上历史记录继续保留，不因 R1-B 改写或删除。

## 当前晋级源

R1-B 绑定的精确来源：

- `main` SHA：`6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7`；
- main push Validation run：`30440545497`；
- Validate job：`90538558839`；
- PostgreSQL 18 job：`90538558723`；
- Deployment Validator：通过；
- 四个 PostgreSQL examples：通过；
- 六类永久 Artifact digest：完整。

## 已发布镜像

```text
ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13
```

发布证据：

- build run：`30440674461`；
- release evidence Artifact ID：`8719335176`；
- Artifact digest：`sha256:03d7a7aa35b99436237494dae1f1048b828812651e4b39b4c8c82ea41a6aeef5`；
- digest pull verification：`PASSED`；
- SPDX JSON SBOM：`sha256:94a4a77a76f4802c9ff4a238e63854e1619d2ce46fd6a5eaef1e2698eb033702`；
- provenance attestation ID：`37705043`；
- SBOM attestation ID：`37705058`。

仓库内的 `releases/m2/release-image-evidence.json` 与 `releases/m2/r1b-image-binding.json` 将这些真实外部结果绑定到 Promotion 和 Deployment。

## Blocker 关闭规则

| Blocker | 唯一允许的关闭证据 | 当前状态 |
|---|---|---|
| `main-branch-final-ci-not-verified` | 精确 main SHA、真实 push run、成功 jobs/Deployment step 与六类 Artifact digest | 已解决 |
| `external-registry-digest-missing` | GHCR `@sha256:` 引用、Registry digest、build run、source SHA、SBOM、双 Attestation、digest pull verification 与 R1-B binding | 已解决 |
| `production-secrets-not-configured` | 允许的 Secret Provider、版本化引用、配置时间；不得包含 Secret 值 | 开放 |
| `target-cluster-validation-not-run` | cluster ref、验证 run、source/image/manifest digest 与通过时间 | 开放 |
| `change-approval-missing` | 非占位审批系统、审批号、批准时间 | 开放 |
| `release-owner-approval-missing` | 非占位审批系统、审批号、批准时间 | 开放 |

`resolvedBlockers` 必须严格由对应证据推导。只要 `openBlockers` 非空，`productionEligible` 就必须为 `false`。

## R1-B 永久绑定

R1-B Validator 独立重算：

- release image evidence canonical digest；
- R1-B binding canonical digest；
- Production Promotion canonical digest；
- Deployment manifest canonical digest。

它同时验证：

- source SHA、main CI run/jobs/Artifacts；
- release Workflow run 与 Artifact ID/digest；
- Registry digest、不可变引用、SBOM 和双 Attestation；
- Promotion imageRelease 与 release evidence 完全一致；
- Deployment 使用相同 `@sha256:` 引用；
- Secret、集群与审批字段继续保持安全缺失状态。

## 当前安全状态

已解决：

- `main-branch-final-ci-not-verified`；
- `external-registry-digest-missing`。

继续开放：

- `production-secrets-not-configured`；
- `target-cluster-validation-not-run`；
- `change-approval-missing`；
- `release-owner-approval-missing`。

因此：

```text
productionEligible=false
```

## 明确不在范围内

- 自动生产部署或 rollout；
- 创建或提交真实 Secret；
- 访问目标集群；
- 创建 Change/Release Owner 审批；
- M2-J 或任何 M3 功能；
- Worker、Queue、Scheduler、Kubernetes Job；
- 测试执行、结果采集、Allure、k6/xk6 或 Playwright。
