# M1 发布验收矩阵

| 领域 | 验收内容 | 自动证据 | M1-RC1 |
|---|---|---|---|
| Stack | PR #1～#10 base/head 连续 | release candidate validator | 必须通过 |
| Registry | 版本、CAS、审计、PostgreSQL 恢复 | Node + PostgreSQL tests | 已覆盖 |
| Governance | 职责分离、审核 revision、原子发布 | Governance contract/integration | 已覆盖 |
| Authorization | 项目成员、状态、有效期、默认拒绝 | Membership tests | 已覆盖 |
| Authentication | RS256、issuer/audience、JWKS rotation | OIDC/JWKS tests | 已覆盖 |
| HTTP | 五条 GET、请求限制、错误脱敏 | HTTP contract + E2E | 必须通过 |
| Operations | /live、/ready、启动与关闭 | Service tests | 已覆盖 |
| Fault | PostgreSQL/JWKS 故障与恢复 | Fault acceptance | 已覆盖 |
| Container | 非 Root、只读根、drop ALL | Docker CI | 已覆盖 |
| Kubernetes | 探针、PDB、RollingUpdate、Pod Security | Manifest validator | 已覆盖 |
| Release | candidate/manifest/image evidence | release evidence | 必须通过 |

## 生产晋级阻断项

M1-RC1 通过后仍需：

- 外部镜像 Registry digest；
- 目标环境 Secret 引用；
- 目标集群 server-side dry-run；
- main 分支最终 CI；
- 发布负责人批准。

任何一项缺失时 `productionEligible=false`。
