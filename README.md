# Knowledge-Driven Test Platform

面向多项目的知识驱动企业测试平台。平台以结构化知识定义业务、数据、权限、流程、性能、可靠性和合规边界，以统一执行引擎生成测试计划、运行测试并沉淀可审计证据。

## 核心原则

- **平台统一，项目隔离**：执行机制统一，每个项目拥有独立边界包。
- **基线继承，受控覆盖**：公司基线、领域能力包、项目规则、环境参数和发布覆盖按固定优先级解析。
- **知识先于测试**：测试必须引用已发布知识，禁止无依据的正式测试。
- **快照不可变**：每次执行固定知识快照，保证历史结果可复现。
- **规则可审计**：每条知识有唯一 ID、版本、来源、负责人、风险和生命周期。
- **职责分离**：作者、审核人和发布人按项目授权，审核绑定精确 Registry revision。
- **AI 辅助而不裁决**：AI 可提取、生成和分析，最终规则与质量门禁由结构化知识和确定性代码执行。

## 首阶段范围

当前阶段建立平台地基：

1. 多项目知识模型；
2. 五层规则解析；
3. 强制规则与覆盖策略；
4. 确定性知识快照；
5. 示例项目与验证测试；
6. 版本化知识 Schema 与 Registry 领域边界；
7. PostgreSQL 持久化 Registry Adapter、migration 与真实数据库合同测试；
8. 项目授权、revision 绑定审核、发布策略、审计查询和不可变快照 Store。

暂不包含 HTTP API、身份认证、RBAC 管理后台、向量检索、生产执行调度和大规模分布式压测。

## 仓库结构

```text
apps/                 可执行应用和 CLI
packages/             可复用核心包
schemas/              版本化知识、Registry 和治理 Schema
examples/             多项目与治理示例
docs/                 架构、开发、治理和路线图
scripts/              仓库验证脚本
.github/workflows/     持续集成
```

## 本地验证

```bash
npm test
npm run validate
npm run example:approval
npm run example:registry
npm run example:governance

# 完整 PostgreSQL 合同测试需要本地数据库与 pg 驱动
docker compose -f deploy/postgres/compose.yaml up -d
npm install --no-save --package-lock=false pg@8.22.0
KDTP_POSTGRES_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55432/kdtp_test npm run test:postgres
```

详细设计见 [`docs/README.md`](docs/README.md)。
