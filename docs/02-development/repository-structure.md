# Monorepo 结构

```text
knowledge-driven-test-platform/
├── apps/
│   └── knowledge-cli/          本地解析与验证 CLI
├── packages/
│   ├── knowledge-core/         模型校验、分层解析、快照构建
│   ├── knowledge-registry/     Registry 领域边界与内存适配器
│   ├── knowledge-registry-postgres/ PostgreSQL 持久化适配器
│   └── knowledge-governance/   项目授权、审核策略、审计和快照 Store
├── schemas/                    版本化 JSON Schema
├── deploy/postgres/            本地 PostgreSQL 环境
├── examples/                   多项目、Registry 与治理示例
├── docs/
├── scripts/
└── .github/workflows/
```

## 演进方向

后续按独立切片增加：

```text
packages/knowledge-governance-postgres/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/knowledge-api/
apps/quality-console/
```

## 依赖方向

```text
apps → packages
knowledge-governance → knowledge-registry
knowledge-governance → knowledge-core
knowledge-registry-postgres → knowledge-registry
examples → 不作为生产依赖
```

核心包不得依赖应用层，也不得读取网络或环境中的隐式全局状态。

## M1-A 新增结构

```text
packages/knowledge-registry/   Registry 端口、生命周期和内存适配器
schemas/knowledge/             版本化 JSON Schema 与目录
examples/registry-lifecycle.js Registry 发布生命周期示例
```

## M1-B 新增结构

```text
packages/knowledge-registry-postgres/  PostgreSQL adapter、migration 与集成测试
deploy/postgres/                       本地 PostgreSQL Compose 环境
examples/postgres-registry.js          durable adapter 组合示例
```

PostgreSQL adapter 不读取隐式环境变量，也不负责创建或关闭连接池。

## M1-C 新增结构

```text
packages/knowledge-governance/   项目授权、审核策略、审计查询和快照 Store
schemas/governance/              审核决策与快照 envelope Schema
examples/governance-lifecycle.js 治理发布和快照示例
```

身份、审核决策和快照持久化都通过 Port 注入。治理包不依赖 PostgreSQL Adapter、应用层或传输层。
