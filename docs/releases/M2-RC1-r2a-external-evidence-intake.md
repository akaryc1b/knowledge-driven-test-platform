# M2-RC1 R2-A External Evidence Intake

## 目标与边界

R2-A 为 Production Promotion 剩余四类外部证据建立统一、追加式、可审计的输入契约与防伪门禁。本切片只定义并验证输入，不访问 Secret Provider、目标 Kubernetes 集群或审批系统，也不修改 `releases/m2/production-promotion.json` 的 blocker 状态。

固定绑定：

- 契约基线 main SHA：`ebfa1a16f95146b48f11934aecc3d41bcd605f57`；
- 发布来源 SHA：`6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7`；
- Registry digest：`sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13`；
- Deployment manifest canonical digest：`sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45`。

`contractBaseSha` 证明 R2-A 从 R1-B 合并后的最新 main 开始；`releaseSourceSha` 继续绑定已发布镜像的真实构建来源。二者不得互换。

## 统一状态模型

每类输入只能处于以下状态之一：

| 状态 | 含义 | 是否允许关闭 blocker |
|---|---|---|
| `NOT_PROVIDED` | 没有提交外部证据 | 否 |
| `PROVIDED_UNVERIFIED` | 字段格式与绑定可以解析，但尚未通过真实外部查询 | 否 |
| `VERIFIED` | 外部查询通过，查询记录 ID、来源、时间和载荷绑定一致 | 仅允许后续独立安全切片使用 |
| `REJECTED` | 输入因格式、占位、敏感信息、ID、时间或绑定不一致被拒绝 | 否 |

R2-A 仓库中的四项初始状态全部固定为 `NOT_PROVIDED`。即使测试夹具能够证明 Validator 可识别 `VERIFIED`，R2-A 仍输出 `promotionMutationAllowed=false`，不得关闭任何 blocker。

## 通用输入信封

四类输入使用同一信封字段：

- `schemaVersion`：输入类型的精确版本；
- `status`：统一状态；
- `providedAt`：严格 UTC ISO-8601，必须包含毫秒并以 `Z` 结尾；
- `submissionDigest`：载荷 canonical JSON 的 `sha256:<64 lowercase hex>`；
- `payload`：只保存无敏感信息的外部事实；
- `verification`：外部验证结果、方法、来源系统、外部记录 ID、验证时间和失败原因码。

`NOT_PROVIDED` 必须具有空载荷、空提交时间、空 digest，并使用 `verification.result=NOT_RUN` 与 `reasonCode=NOT_PROVIDED`。

`PROVIDED_UNVERIFIED` 必须具有格式正确的载荷与匹配 digest，但外部验证元数据必须为空，原因码固定为 `AWAITING_EXTERNAL_VERIFICATION`。

`VERIFIED` 必须满足：

1. `verification.result=PASSED`；
2. 验证方法与证据类型严格匹配；
3. `sourceSystem` 和 `externalRecordId` 非占位；
4. `externalRecordId` 精确等于载荷的 `verificationRecordId`；
5. `verifiedAt` 不早于 `providedAt`；
6. release、version、发布来源 SHA、镜像 digest，以及适用时的 Deployment digest 全部一致。

`REJECTED` 必须使用允许的失败原因码，并保留安全的验证元数据；若原始载荷含敏感信息，可不保存载荷，只保存提交 digest 与拒绝结果。

## Production Secret References

Schema：`m2-production-secret-references-input/v1`。

允许 Provider 只继承仓库既有 allow-list：

- `aws-secrets-manager`；
- `azure-key-vault`；
- `gcp-secret-manager`；
- `hashicorp-vault`；
- `kubernetes-external-secrets`。

必填载荷：release、version、发布来源 SHA、镜像 digest、Provider、至少一个 Secret 引用、配置时间、外部验证记录 ID。

每个 Secret 引用只允许保存：

- 逻辑名称；
- 明确版本化外部引用；
- 外部资源标识。

禁止 `latest`、未固定版本、Secret 值、用户名、密码、连接串、Token、私钥、kubeconfig、OIDC Subject Mapping 内容或 base64 Secret 内容。验证方法固定为 `SECRET_PROVIDER_METADATA_READ`。只有后续 R2-B 取得真实 Provider metadata read 结果并使输入达到 `VERIFIED`，才可能关闭 `production-secrets-not-configured`。

## Target Cluster Validation

Schema：`m2-target-cluster-validation-input/v1`。

必填载荷包括：

- release、version、发布来源 SHA、镜像 digest、Deployment digest；
- 真实 cluster reference；
- Kubernetes Server Version；
- Namespace reference；
- 验证 Workflow Run ID；
- API discovery、server-side dry-run、admission compatibility、依赖读取、权限评估、节点架构结果的独立 digest；
- 验证时间与外部验证记录 ID。

验证方法固定为 `KUBERNETES_READ_ONLY_AND_SERVER_SIDE_DRY_RUN`。只有后续 R2-C 在真实目标集群完成只读 discovery 与 server-side dry-run，并达到 `VERIFIED`，才可能关闭 `target-cluster-validation-not-run`。本契约不授权 `apply`、`create`、patch、rollout、restart 或 Helm 写操作。

## Change Approval

Schema：`m2-change-approval-input/v1`。

必填载荷包括审批系统、Approval ID、变更范围、`APPROVED` 状态、审批时间、release、version、发布来源 SHA、Registry digest 与外部验证记录 ID。验证方法固定为 `CHANGE_APPROVAL_SYSTEM_QUERY`。

GitHub Issue/PR 编号、合并授权、当前会话文本或仓库 Markdown 声明不能替代外部 Change Approval。只有后续 R2-D 的真实查询结果达到 `VERIFIED`，才可能关闭 `change-approval-missing`。

## Release Owner Approval

Schema：`m2-release-owner-approval-input/v1`。

必填载荷包括审批系统、受控 Release Owner 标识、Approval ID、`APPROVED` 状态、审批时间、release、version、发布来源 SHA、Registry digest 与外部验证记录 ID。验证方法固定为 `RELEASE_OWNER_APPROVAL_SYSTEM_QUERY`。

PR 合并授权、当前会话中的同意或自行指定的 Owner 不能替代外部 Release Owner Approval。只有后续 R2-E 的真实查询结果达到 `VERIFIED`，才可能关闭 `release-owner-approval-missing`。

## 防伪与敏感信息门禁

Validator 拒绝：

- placeholder、sample、dummy、fake、TODO、TBD、unknown 等占位语义；
- 重复字符或顺序字符组成的 SHA/digest；
- 可变 Secret 引用或 `latest`；
- 非 canonical UTC timestamp；
- submission digest 与 payload 不一致；
- 外部记录 ID 不一致；
- release、version、SHA、镜像或 Deployment digest 绑定不一致；
- 数据库 URL、凭证、Bearer Token、GitHub Token、云访问密钥、私钥、Secret 值、kubeconfig 或 Kubernetes Secret data。

任何验证错误均 fail closed，不更新 Promotion，不移动 blocker。

## 永久验证

R2-A 同时接入：

- 通用 `validation` PR/main-push Workflow；
- 独立 `m2-r2a-external-evidence-intake` PR/main-push/manual Workflow；
- 全量 Node 测试；
- PostgreSQL 18 全量测试与四个 PostgreSQL examples；
- Repository、Deployment、Production Promotion、R0、R1-B 与 R2-A Validator；
- Docker build、non-root 与 hardened runtime 回归；
- `m2-r2a-external-evidence-intake-evidence` 永久 Artifact。

## R2-A 结束状态

- 不创建 Secret；
- 不访问目标集群；
- 不修改目标集群；
- 不执行 rollout；
- 不创建审批；
- 四类真实外部证据均未提供；
- 四个外部 blocker 全部保持开放；
- `productionEligible=false`。
