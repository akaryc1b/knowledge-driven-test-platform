# Knowledge-Driven Test Platform

面向多项目的知识驱动企业测试平台。平台以结构化知识定义业务、权限、流程、性能、可靠性和合规边界，并沉淀可审计证据。

## 核心原则

- **平台统一，项目隔离**：执行机制统一，每个项目拥有独立边界包。
- **基线继承，受控覆盖**：公司、领域、项目、环境和发布规则按固定优先级解析。
- **知识先于测试**：正式测试必须引用已发布知识。
- **快照不可变**：每次执行固定知识快照，历史结果可复现。
- **职责分离**：作者、审核人和发布人按项目授权。
- **成员默认拒绝**：成员缺失、暂停、撤销、未生效或过期时不授权。
- **信任根显式**：OIDC issuer、audience 和 JWKS URI 由应用配置。
- **运维与部署入库**：探针、关闭、容器和 Kubernetes 行为均有版本化合同。
- **证据先于合并**：堆叠 PR 在合并前必须通过最终头分支发布验收。
- **AI 辅助而不裁决**：最终规则和质量门禁由结构化知识和确定性代码执行。

## M1-RC1 候选能力

1. 五层知识模型、确定性解析与不可变快照；
2. PostgreSQL Registry、CAS、审核证据和 Governance Unit of Work；
3. 项目成员、固定角色和默认拒绝授权；
4. 五条项目隔离只读查询路由；
5. RS256 OIDC/JWKS、Key Rotation 和 Subject Mapping；
6. `/live`、`/ready`、运行事件和优雅关闭；
7. 非 Root 容器与 Kubernetes Pod Security 基线；
8. PostgreSQL、JWKS、SIGTERM 和完整只读 E2E 验收；
9. 发布候选、Manifest digest 和镜像证据模型。

M1-RC1 仍是 Candidate。写入 API、管理后台、自动生产发布、Worker、队列和 M2 功能均未开放。

## 本地验证

```bash
npm test
npm run validate
npm run validate:deployment
npm run validate:release
npm run example:release
```

完整示例：

```bash
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

PostgreSQL 18 与真实只读发布 E2E：

```bash
docker compose -f deploy/postgres/compose.yaml up -d
npm install --no-save --package-lock=false pg@8.22.0
KDTP_POSTGRES_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55432/kdtp_test npm run test:postgres
```

应用入口：`apps/read-only-governance-service/src/main.js`

Kubernetes 基线：`deploy/kubernetes/read-only-governance-service/`

发布候选：[`docs/releases/M1-RC1.md`](docs/releases/M1-RC1.md)
