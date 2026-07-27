# M1-RC1 发布候选说明

## 目的

M1-RC1 是知识驱动测试平台的首个只读治理服务候选。它证明知识可以被版本化、持久化、审核、授权、认证、查询和部署，但不授权生产写入或自动发布。

## 候选范围

- Registry 与 Governance：M1-A～M1-D；
- 只读查询与成员授权：M1-E～M1-F；
- HTTP 与 OIDC/JWKS：M1-G～M1-H；
- 服务运维与 Kubernetes：M1-I～M1-J；
- 发布验收和堆叠合并准备：M1-K。

## 通过条件

1. PR #1～#10 基线连续且没有未解决的阻断审查意见；
2. 完整 Node、PostgreSQL 18、Docker 和 Manifest CI 成功；
3. 真实 PostgreSQL、JWKS、JWT、成员授权与五条只读路由端到端成功；
4. PostgreSQL/JWKS 故障只影响 Readiness，恢复后无需重启；
5. SIGTERM 排空请求且容器安全约束通过；
6. 发布证据不包含 Token、私钥、数据库连接串或 Subject Mapping。

## 不等于生产批准

M1-RC1 的 `productionEligible` 固定为 `false`。生产批准需要额外提供：

- 外部镜像仓库不可变 digest；
- 真实 Secret 管理系统引用；
- 目标集群校验和变更审批；
- 堆叠 PR 按顺序合并后的最终 main CI；
- 独立发布负责人签署。
