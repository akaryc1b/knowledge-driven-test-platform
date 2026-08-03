# 文档导航

## 产品与范围

- [愿景与范围](00-overview/vision-and-scope.md)
- [术语与核心概念](00-overview/glossary.md)

## 架构

- [系统总体架构](01-architecture/system-architecture.md)
- [多项目边界模型](01-architecture/multi-project-boundary-model.md)
- [知识分层与解析](01-architecture/knowledge-layering-and-resolution.md)
- [不可变知识快照](01-architecture/immutable-knowledge-snapshot.md)

## 开发

- [Monorepo 结构](02-development/repository-structure.md)
- [开发规范](02-development/development-standards.md)
- [测试策略](02-development/testing-strategy.md)
- [历史 M3-R0 入口交接（永久兼容锚点）](02-development/development-handoff.md)
- [当前 M3-R2-G1 交接](02-development/m3-r2-g1-handoff.md)

## 路线图

- [总体路线图](03-roadmap/roadmap.md)
- [M0 基础阶段](03-roadmap/m0-foundation.md)
- [M1 Registry 与治理](03-roadmap/m1-registry-and-governance.md)
- [M1-B Durable Registry Adapter](03-roadmap/m1-b-durable-registry.md)
- [M1-C Governance Service Boundary](03-roadmap/m1-c-governance-service.md)
- [M1-D Durable Governance Evidence](03-roadmap/m1-d-durable-governance-evidence.md)
- [M1-E Read-Only Governance Query API](03-roadmap/m1-e-read-only-query-api.md)
- [M1-F Durable Project Membership](03-roadmap/m1-f-project-membership.md)
- [M1-G Read-Only HTTP and Authentication](03-roadmap/m1-g-read-only-http-auth.md)
- [M1-H OIDC/JWKS Authentication](03-roadmap/m1-h-oidc-jwks-auth.md)
- [M1-I Read-Only Service Composition](03-roadmap/m1-i-read-only-service-composition.md)
- [M1-J Deployment and Fault Acceptance](03-roadmap/m1-j-read-only-deployment-fault-acceptance.md)
- [M1-K Release Acceptance and Stack Consolidation](03-roadmap/m1-k-read-only-release-acceptance.md)
- [M2 Governed Deterministic Test Planning](03-roadmap/m2-governed-deterministic-test-planning.md)
- [M2-A Test Planning Contracts and Identity](03-roadmap/m2-a-test-planning-contracts.md)
- [M2-B Versioned Capability Catalog](03-roadmap/m2-b-versioned-capability-catalog.md)
- [M2-C Deterministic Planner and Coverage](03-roadmap/m2-c-deterministic-planner.md)
- [M2-D Durable Test Plan Registry](03-roadmap/m2-d-durable-test-plan-registry.md)
- [M2-E Plan Governance and Review](03-roadmap/m2-e-plan-governance.md)
- [M2-F Durable Planning Orchestration](03-roadmap/m2-f-planning-orchestration.md)
- [M2-G Read-Only Plan Query API](03-roadmap/m2-g-read-only-plan-query-api.md)
- [M2-H Planning Service Composition and Operations](03-roadmap/m2-h-planning-service-composition.md)
- [M2-I M2 Release Acceptance](03-roadmap/m2-i-release-acceptance.md)
- [M2-RC1 Post-Merge Acceptance Closure](03-roadmap/m2-rc1-post-merge-acceptance.md)
- [M2-RC1 Release Readiness](03-roadmap/m2-rc1-production-promotion.md)
- [M3-R0 Execution Adapter Foundation](03-roadmap/m3-r0-execution-adapter-foundation.md)
- [M3-R1 Deterministic Non-Executing k6 API Spec Compiler](03-roadmap/m3-r1-k6-api-spec-compiler.md)
- [M3-R2 Governed Deterministic k6 API Source Generation](03-roadmap/m3-r2-governed-k6-api-source-generation.md)

## 发布与治理

- [M1-RC1 发布候选说明](releases/M1-RC1.md)
- [M2-RC1 发布说明](releases/M2-RC1.md)
- [M2-RC1 合并后验收](releases/M2-RC1-main-acceptance.md)
- [M2-RC1 Historical Production Promotion](releases/M2-RC1-production-promotion.md)
- [M2-RC1 R0 Main CI Closure](releases/M2-RC1-r0-main-ci-closure.md)
- [M2-RC1 Immutable GHCR Image Release](releases/M2-RC1-ghcr-image-release.md)
- [M2-RC1 R1-B Immutable Image Binding](releases/M2-RC1-r1b-image-binding.md)
- [M2-RC1 R2-A External Evidence Intake](releases/M2-RC1-r2a-external-evidence-intake.md)
- [M2-RC1 R2-Rebaseline Portable Release Readiness](releases/M2-RC1-r2-rebaseline-portable-release-readiness.md)
- [M2-RC1 Final Release Closure](releases/M2-RC1-final-release-closure.md)
- [M3-R0 Execution Contract Foundation](releases/M3-R0-execution-contract-foundation.md)
- [M3-R1 k6 API Spec Compiler](releases/M3-R1-k6-api-spec-compiler.md)
- [M3-R2 k6 API Source Generation](releases/M3-R2-k6-api-source-generation.md)
- [M1 发布验收矩阵](04-governance/m1-release-acceptance-matrix.md)
- [M2 Release Readiness 与历史 Promotion 验收矩阵](04-governance/m2-production-promotion-acceptance-matrix.md)
- [M3-R0 Execution Contract 验收矩阵](04-governance/m3-r0-execution-contract-acceptance-matrix.md)
- [M3-R1 k6 API Spec Compiler 验收矩阵](04-governance/m3-r1-k6-api-spec-compiler-acceptance-matrix.md)
- [M3-R2 Source Generation 验收矩阵](04-governance/m3-r2-source-generation-acceptance-matrix.md)
- [知识治理](04-governance/knowledge-governance.md)
- [多项目安全与隔离](04-governance/security-and-isolation.md)

## 安全

- [M3-R2 Source Generation Threat Model](06-security/m3-r2-source-generation-threat-model.md)

## 架构决策

- [ADR-0001：Monorepo 与零依赖核心](05-adr/ADR-0001-monorepo-zero-dependency-core.md)
- [ADR-0002：分层边界解析](05-adr/ADR-0002-layered-boundary-resolution.md)
- [ADR-0003：不可变快照](05-adr/ADR-0003-immutable-snapshots.md)
- [ADR-0004：Registry Port 与追加式版本](05-adr/ADR-0004-registry-port-and-append-only-versions.md)
- [ADR-0005：PostgreSQL Durable Registry](05-adr/ADR-0005-postgresql-durable-registry.md)
- [ADR-0006：Revision 绑定治理](05-adr/ADR-0006-revision-bound-governance.md)
- [ADR-0007：单数据库 Governance Unit of Work](05-adr/ADR-0007-single-database-governance-unit-of-work.md)
- [ADR-0008：运输无关只读查询](05-adr/ADR-0008-transport-independent-read-query-boundary.md)
- [ADR-0009：成员驱动默认拒绝授权](05-adr/ADR-0009-membership-backed-deny-by-default-authorization.md)
- [ADR-0010：认证后构造查询身份](05-adr/ADR-0010-authenticate-before-query-identity.md)
- [ADR-0011：显式 Issuer、JWKS 与 RS256](05-adr/ADR-0011-explicit-issuer-jwks-rs256.md)
- [ADR-0012：显式服务组合与运维探针](05-adr/ADR-0012-explicit-read-only-service-composition.md)
- [ADR-0013：安全 Kubernetes 只读部署基线](05-adr/ADR-0013-secure-kubernetes-read-only-baseline.md)
- [ADR-0014：堆叠合并前先生成发布证据](05-adr/ADR-0014-evidence-before-stack-merge.md)
- [ADR-0015：确定性测试计划身份](05-adr/ADR-0015-deterministic-test-plan-identity.md)
- [ADR-0016：版本化 Capability Catalog](05-adr/ADR-0016-versioned-capability-catalog.md)
- [ADR-0017：确定性 Planner、Coverage、Provenance 与 DAG](05-adr/ADR-0017-deterministic-planner-coverage-provenance-dag.md)
- [ADR-0018：PostgreSQL Durable Test Plan Registry](05-adr/ADR-0018-durable-test-plan-registry.md)
- [ADR-0019：Revision-Bound Plan Governance and Freeze Gate](05-adr/ADR-0019-revision-bound-plan-governance.md)
- [ADR-0020：Single-Transaction Durable Planning Orchestration](05-adr/ADR-0020-single-transaction-planning-orchestration.md)
- [ADR-0021：Project-Isolated Read-Only Test Plan Queries](05-adr/ADR-0021-read-only-test-plan-queries.md)
- [ADR-0022：Unified Read-Only Knowledge and Test Plan Service Composition](05-adr/ADR-0022-unified-read-only-planning-service-composition.md)
- [ADR-0023：M2 堆叠合并前先固定发布证据](05-adr/ADR-0023-evidence-before-m2-stack-merge.md)
- [ADR-0024：保留候选证据并追加合并后验收](05-adr/ADR-0024-post-merge-release-acceptance.md)
- [ADR-0025：以追加证据而非改写历史完成生产晋级](05-adr/ADR-0025-production-promotion-evidence.md)
- [ADR-0026：以精确 main SHA 和 Registry digest 发布 GHCR 镜像](05-adr/ADR-0026-immutable-ghcr-release-image.md)
- [ADR-0027：先建立不可变执行合同，再实现 Adapter](05-adr/ADR-0027-contract-first-execution-boundary.md)
- [ADR-0028：以中立 IR 隔离 k6 API 编译与执行](05-adr/ADR-0028-deterministic-non-executing-k6-api-spec-compiler.md)
- [ADR-0029：受治理的确定性 k6 Source Generation 边界](05-adr/ADR-0029-governed-deterministic-k6-source-generation.md)
