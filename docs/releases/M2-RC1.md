# M2-RC1 发布候选说明

## 目的

M2-RC1 是治理型确定性测试规划的首个候选。它证明已发布知识可形成不可变 Snapshot，并经过 Capability Catalog、确定性 Planner、Coverage、Provenance、持久化治理和只读服务查询形成可审计的 `FROZEN` Test Plan。

## 候选范围

- M2-A～M2-C：合同、能力目录、确定性 Planner；
- M2-D～M2-F：PostgreSQL Registry、治理、原子 Orchestration；
- M2-G～M2-H：五条计划查询路由与统一只读服务组合；
- M2-I：独立候选、Schema/Stack digest 与正式验收证据。

## 验收

- PR #12～#19 堆叠连续；
- PostgreSQL 18 中完成 Generate → Submit → Review → Approve → Freeze → Reload；
- PostgreSQL、JWKS、RS256 JWT、Membership 与十条只读路由端到端；
- PostgreSQL/JWKS 故障只影响 readiness，恢复无需重启；
- 缺少 Token、跨项目访问和全部写方法被拒绝；
- Docker 非 Root、只读根文件系统和部署校验通过；
- M1-RC1 证据继续生成且未被修改。

## 不等于生产批准

`productionEligible=false`。M2 堆叠尚未合并，且缺少外部镜像 digest、生产 Secret 引用、目标集群验证、变更审批、合并后 main CI 与独立发布负责人签署。
