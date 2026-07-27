# M1-A 当前开发交接

## M0 已完成

- 多项目五层知识模型；
- 规则运行时校验；
- 同层冲突检测；
- deny、strengthen、allow 覆盖策略；
- mandatory 不可关闭；
- 解析来源链；
- 规范化 JSON 与 SHA-256 快照；
- 审批平台示例；
- CLI、单元测试和 CI。

## M1-A 已完成

- `knowledge-rule/v1` JSON Schema 与 Schema Catalog；
- 知识逻辑 ID 校验；
- 严格 `MAJOR.MINOR.PATCH` 版本；
- `id@version` 唯一键；
- 新版本单调递增；
- 异步 `KnowledgeRegistryPort`；
- `InMemoryKnowledgeRegistry`；
- revision CAS；
- 草稿防覆盖更新；
- DRAFT、REVIEWING、PUBLISHED、DEPRECATED、ARCHIVED 生命周期；
- 已发布内容不可替换；
- 审计 actor、UTC 时间和原因；
- 防御性副本；
- 可复用 Registry 合同测试；
- 示例知识全部迁移到 `knowledge-rule/v1`。

## 当前边界

- Registry 仅存在于进程内；
- Resolver 仍从项目 JSON 文件直接装载 PUBLISHED 规则；
- 没有数据库、HTTP 服务、UI、认证和调度；
- 没有跨记录事务或旧版本自动废弃；
- 没有项目级发布权限检查；
- 没有 Schema v2 或迁移器；
- 快照仍只输出到 stdout 或本地文件。

## 下一安全切片

`M1-B — Durable Registry Adapter`

只允许：

- PostgreSQL 数据模型和迁移；
- 知识记录、审计历史和 revision 持久化；
- 事务、唯一约束和 CAS；
- PostgreSQL Registry Adapter；
- 复用 M1-A Registry 合同测试；
- 容器化本地数据库测试环境。

暂不允许：

- 对外 HTTP API；
- 登录、RBAC 和项目成员系统；
- 管理后台；
- AI 自动审核或发布；
- k6 Worker 或生产执行。
