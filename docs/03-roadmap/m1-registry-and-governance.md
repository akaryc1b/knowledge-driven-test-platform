# M1 — Registry and Governance

## 目标

将公司知识从文件输入升级为经过版本化、持久化、项目授权、审核、不可变证据、安全认证、可运维服务和可审查部署治理的可信资产。

## 已完成切片

- M1-A：版本化 Knowledge Registry；
- M1-B：PostgreSQL Registry；
- M1-C：Governance Service；
- M1-D：Durable Governance Evidence；
- M1-E：Read-Only Query；
- M1-F：Project Membership Authorization；
- M1-G：Read-Only HTTP；
- M1-H：OIDC/JWKS Authentication；
- M1-I：Service Composition and Operations；
- M1-J：Kubernetes and Fault Acceptance；
- M1-K：Release Acceptance and Stack Consolidation。

M1-K 详细设计见 [`m1-k-read-only-release-acceptance.md`](./m1-k-read-only-release-acceptance.md)。

## M1 完成条件

- PR #1～#10 堆叠连续；
- 最终头分支全量 CI 成功；
- 真实 PostgreSQL/JWKS/JWT/HTTP E2E 成功；
- 发布候选、部署和镜像证据可生成；
- 已知风险和生产阻断项已记录；
- main 合并后必须再次执行同等验收。

## M1 之后

M2 仍保持冻结。只有 M1 堆叠完成评审、按顺序合并并在 main 通过最终验收后，才能在独立会话中规划 Test Planning。

写入 HTTP API、自动生产发布、管理后台、Worker、队列和生产测试执行继续在范围外。
