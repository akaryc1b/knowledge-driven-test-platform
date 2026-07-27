# Monorepo 结构

```text
knowledge-driven-test-platform/
├── apps/
│   └── knowledge-cli/          本地解析与验证 CLI
├── packages/
│   └── knowledge-core/         模型校验、分层解析、快照构建
├── examples/
│   └── approval-platform/      首个多项目示例
├── docs/
├── scripts/
└── .github/workflows/
```

## 演进方向

后续按独立切片增加：

```text
packages/knowledge-schema/
packages/test-planner/
packages/k6-adapter/
packages/evidence-model/
apps/knowledge-api/
apps/quality-console/
```

## 依赖方向

```text
apps → packages
packages/knowledge-core → Node.js 标准库
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

依赖方向保持为：

```text
knowledge-registry-postgres → knowledge-registry → Node.js 标准库
应用组合根 → pg Pool → knowledge-registry-postgres
```

PostgreSQL adapter 不读取隐式环境变量，也不负责创建或关闭连接池。
