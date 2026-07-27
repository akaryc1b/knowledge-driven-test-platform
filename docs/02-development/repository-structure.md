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
