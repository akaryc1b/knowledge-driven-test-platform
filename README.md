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
- **成员默认拒绝**：项目或成员缺失、暂停、撤销、未生效或过期时不授予任何治理动作。
- **信任根显式**：OIDC issuer、audience 和 JWKS URI 由应用配置，Token 不能控制签名 key 来源。
- **AI 辅助而不裁决**：AI 可提取、生成和分析，最终规则与质量门禁由结构化知识和确定性代码执行。

## 当前阶段能力

1. 多项目五层知识模型与受控覆盖；
2. 确定性知识快照；
3. 版本化 Registry 与 PostgreSQL 持久化；
4. 职责分离、revision 绑定审核和发布策略；
5. PostgreSQL 审核证据、不可变快照与 Governance Unit of Work；
6. 项目隔离的知识、审核和快照只读查询；
7. 项目目录、成员状态、有效期和固定角色授权；
8. 只读 Node HTTP、请求安全、限流和稳定响应；
9. RS256 OIDC/JWKS、key rotation、subject mapping 和认证事件。

暂不包含写入 HTTP API、登录页面、Session、Refresh Token、IdP/RBAC 管理后台、生产执行调度和大规模分布式压测。

## 本地验证

```bash
npm test
npm run validate
npm run example:approval
npm run example:registry
npm run example:governance
npm run example:query
npm run example:access
npm run example:http
npm run example:oidc

# PostgreSQL 验证
docker compose -f deploy/postgres/compose.yaml up -d
npm install --no-save --package-lock=false pg@8.22.0
KDTP_POSTGRES_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55432/kdtp_test npm run test:postgres
```

详细设计见 [`docs/README.md`](docs/README.md)。
