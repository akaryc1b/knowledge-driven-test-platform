# Knowledge-Driven Test Platform

面向多项目的知识驱动企业测试平台。平台以结构化知识定义业务、数据、权限、流程、性能、可靠性和合规边界，以统一执行引擎生成测试计划、运行测试并沉淀可审计证据。

## 核心原则

- **平台统一，项目隔离**：执行机制统一，每个项目拥有独立边界包。
- **基线继承，受控覆盖**：公司基线、领域能力包、项目规则、环境参数和发布覆盖按固定优先级解析。
- **知识先于测试**：测试必须引用已发布知识，禁止无依据的正式测试。
- **快照不可变**：每次执行固定知识快照，保证历史结果可复现。
- **规则可审计**：每条知识有唯一 ID、版本、来源、负责人、风险和生命周期。
- **职责分离**：作者、审核人和发布人按项目授权，审核绑定精确 Registry revision。
- **证据原子提交**：审核决定、快照和 Registry 状态通过 Governance Unit of Work 受控持久化。
- **只读查询先行**：查询 Handler 与网络框架解耦，身份、项目隔离和错误响应在应用边界内确定。
- **AI 辅助而不裁决**：AI 可提取、生成和分析，最终规则与质量门禁由结构化知识和确定性代码执行。

## 当前阶段能力

1. 多项目五层知识模型与受控覆盖；
2. 确定性知识快照；
3. 版本化 Registry 领域边界；
4. PostgreSQL Registry 与真实数据库合同测试；
5. 项目授权、revision 绑定审核和发布策略；
6. PostgreSQL append-only 审核证据；
7. PostgreSQL immutable 快照 envelope；
8. 单数据库 Governance Unit of Work 与并发发布保护；
9. 项目隔离的只读知识、审核和快照查询；
10. 请求身份上下文、稳定 DTO、游标分页和错误 envelope。

暂不包含写入 HTTP API、身份认证、RBAC 管理后台、向量检索、生产执行调度和大规模分布式压测。

## 本地验证

```bash
npm test
npm run validate
npm run example:approval
npm run example:registry
npm run example:governance
npm run example:query

# PostgreSQL 验证
docker compose -f deploy/postgres/compose.yaml up -d
npm install --no-save --package-lock=false pg@8.22.0
KDTP_POSTGRES_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55432/kdtp_test npm run test:postgres
```

详细设计见 [`docs/README.md`](docs/README.md)。
