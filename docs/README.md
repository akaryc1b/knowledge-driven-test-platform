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
- [当前开发交接](02-development/development-handoff.md)

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

## 治理

- [知识治理](04-governance/knowledge-governance.md)
- [多项目安全与隔离](04-governance/security-and-isolation.md)

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
- [ADR-0011：显式 issuer/JWKS 与首版 RS256](05-adr/ADR-0011-explicit-issuer-jwks-rs256.md)
