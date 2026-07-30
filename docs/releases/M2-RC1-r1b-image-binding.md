# M2-RC1 R1-B Immutable Image Binding

## 目标

R1-B 将 R1-A 已真实发布并验证的 GHCR 镜像永久绑定到仓库内 Production Promotion 与 Kubernetes Deployment。

本切片只关闭 `external-registry-digest-missing`。它不配置生产 Secret，不访问目标集群，不伪造 Change 或 Release Owner 审批，也不授予生产发布资格。

## 真实来源

发布来源：

- `main` SHA：`6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7`；
- main push Validation run：`30440545497`；
- Validate job：`90538558839`；
- PostgreSQL 18 job：`90538558723`；
- 四个 PostgreSQL examples：全部通过。

发布 Workflow：

- Workflow：`.github/workflows/m2-release-image.yml`；
- run：`30440674461`；
- release evidence Artifact ID：`8719335176`；
- Artifact 名称：`m2-release-image-evidence-6bef789da58b`；
- Artifact digest：`sha256:03d7a7aa35b99436237494dae1f1048b828812651e4b39b4c8c82ea41a6aeef5`。

## 不可变镜像

```text
ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13
```

验证结果：

- Registry digest：`sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13`；
- digest 回拉和 hardened runtime：`PASSED`；
- SPDX JSON SBOM：`sha256:94a4a77a76f4802c9ff4a238e63854e1619d2ce46fd6a5eaef1e2698eb033702`；
- provenance attestation ID：`37705043`；
- provenance bundle：`sha256:9713617e86d763075dff8e5b1394a1c7a97c0f8ef4d05a2310670daa5d90b6be`；
- SBOM attestation ID：`37705058`；
- SBOM bundle：`sha256:0191ec23424d1e0128ded4a3a57dc2f489b6ab07629210d84de27e008d5cdc84`。

## 永久仓库证据

R1-B 新增：

- `releases/m2/release-image-evidence.json`：R1-A Artifact 中的无敏感信息发布证据副本；
- `releases/m2/r1b-image-binding.json`：main CI、发布 Artifact、仓库证据与 Deployment 的绑定记录；
- `m2-r1b-image-binding/v1` 与 `m2-r1b-image-binding-evidence/v1` schema；
- `scripts/validate-m2-r1b-image-binding.js`：独立重算和交叉校验；
- `.github/workflows/m2-r1b-image-binding.yml`：只读、手动、可重复的永久验收 Workflow。

规范化 digest：

- release-image evidence：`sha256:dcc912aada0bb5f4337cec0682ee081ac40fe4e1bf2cb6ad6203df3b3c45492a`；
- R1-B binding：`sha256:adb6374bee157b7b64d25b6fdfe1b35ea2d4e5e92a08b029c0fbc5e66c33c0a7`；
- Production Promotion：`sha256:4125d5f08ec559e2bc6012ab501879432493af012b4d70665eb1d653c4190f5d`；
- Deployment manifest：`sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45`。

## Promotion 状态

R1-B 完成后：

已解决：

- `main-branch-final-ci-not-verified`；
- `external-registry-digest-missing`。

仍开放：

- `production-secrets-not-configured`；
- `target-cluster-validation-not-run`；
- `change-approval-missing`；
- `release-owner-approval-missing`。

因此 `productionEligible=false`。

## 明确不在范围内

- 创建或配置生产 Secret；
- 访问或修改目标 Kubernetes 集群；
- 执行生产 rollout；
- 填写 Change/Release Owner 审批；
- M2-J、M3、Worker、Queue、Scheduler、Kubernetes Job、测试执行、结果收集、Allure、k6/xk6 或 Playwright。
