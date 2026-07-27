# Knowledge-Driven Test Platform

面向多项目的知识驱动企业测试平台。平台以结构化知识定义业务、数据、权限、流程、性能、可靠性和合规边界，以统一执行引擎生成测试计划、运行测试并沉淀可审计证据。

## 核心原则

- **平台统一，项目隔离**：执行机制统一，每个项目拥有独立边界包。
- **基线继承，受控覆盖**：公司基线、领域能力包、项目规则、环境参数和发布覆盖按固定优先级解析。
- **知识先于测试**：正式测试必须引用已发布知识。
- **快照不可变**：每次执行固定知识快照，历史结果可复现。
- **职责分离**：作者、审核人和发布人按项目授权。
- **成员默认拒绝**：项目或成员缺失、暂停、撤销、未生效或过期时不授予动作。
- **信任根显式**：OIDC issuer、audience 和 JWKS URI 由应用配置。
- **运维先于发布**：服务启动、readiness、运行事件和优雅关闭具有确定性合同。
- **部署约束入库**：Kubernetes 安全、可用性、探针和故障行为由版本化 Manifest 与测试共同证明。
- **AI 辅助而不裁决**：最终规则与质量门禁由结构化知识和确定性代码执行。

## 当前阶段能力

1. 多项目五层知识模型与确定性快照；
2. 版本化 Registry 和 PostgreSQL 持久化；
3. 审核治理、不可变证据和单数据库 Unit of Work；
4. 项目成员、固定角色和默认拒绝授权；
5. 项目隔离的只读查询和稳定 DTO；
6. Node 只读 HTTP、安全请求边界和限流；
7. RS256 OIDC/JWKS、Key Rotation 和 Subject Mapping；
8. 可启动的只读服务组合根；
9. `/live`、`/ready`、结构化运行事件和优雅关闭；
10. 非 Root Docker 镜像；
11. Kubernetes 两副本滚动部署和 Pod Security 基线；
12. PostgreSQL、JWKS 和 SIGTERM 故障验收。

业务 HTTP 仍然只有五条 GET 路由。写入 API、管理后台、生产执行调度和自动生产发布仍未开放。

## 本地验证

```bash
npm test
npm run validate
npm run validate:deployment
npm run example:approval
npm run example:registry
npm run example:governance
npm run example:query
npm run example:access
npm run example:http
npm run example:oidc
npm run example:service
npm run example:deployment
```

PostgreSQL 集成验证：

```bash
docker compose -f deploy/postgres/compose.yaml up -d
npm install --no-save --package-lock=false pg@8.22.0
KDTP_POSTGRES_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55432/kdtp_test npm run test:postgres
```

生产型只读入口位于：

```text
apps/read-only-governance-service/src/main.js
```

Kubernetes 基线位于：

```text
deploy/kubernetes/read-only-governance-service/
```

配置示例见 [`apps/read-only-governance-service/service.env.example`](apps/read-only-governance-service/service.env.example)。详细设计见 [`docs/README.md`](docs/README.md)。
