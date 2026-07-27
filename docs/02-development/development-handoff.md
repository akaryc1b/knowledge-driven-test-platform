# M1-C 当前开发交接

## M0 已完成

- 多项目五层知识模型；
- 规则运行时校验与受控覆盖；
- 解析来源链；
- 规范化 JSON 与 SHA-256 快照；
- 审批平台示例、CLI、单元测试和 CI。

## M1-A 已完成

- `knowledge-rule/v1` 与 Registry Record Schema；
- 逻辑 ID、严格 SemVer 和追加式版本；
- 异步 Registry Port、内存适配器和合同测试；
- revision CAS、生命周期和审计历史。

## M1-B 已完成

- PostgreSQL 18 Registry Adapter；
- knowledge record 与 append-only audit history；
- migration checksum、事务回滚和 advisory lock；
- row lock、revision CAS 与 repeatable-read hydration；
- Docker Compose 与真实 PostgreSQL CI。

## M1-C 已完成

- 独立 `@kdtp/knowledge-governance` package；
- 项目级授权 Port；
- 显式治理动作集合；
- 作者、审核人和发布人职责分离；
- 绑定 Registry revision 的审核决策；
- APPROVE 与 REQUEST_CHANGES；
- risk-level 审批数量策略；
- critical 知识默认双审；
- 治理发布、废弃和归档；
- 审计时间线查询；
- 不可变知识快照 Store Port；
- digest、项目、环境和发布上下文校验；
- 内存授权、审核和快照适配器；
- 可复用 Port 合同测试；
- review decision 与 snapshot envelope Schema。

## 当前边界

- Registry 已有内存与 PostgreSQL 实现；
- Governance 目前只有内存授权、审核决定和快照 Store；
- Resolver 仍从项目 JSON 文件直接加载已发布规则；
- 治理服务没有 HTTP 传输层；
- 身份与项目成员关系由调用方适配；
- Registry、审核 Store 和快照 Store 尚无跨资源事务；
- 没有自动废弃旧知识版本；
- 没有 k6 Worker、队列或生产执行。

## 下一安全切片

`M1-D — Durable Governance Evidence`

只允许：

- PostgreSQL review decision 与 snapshot envelope 表；
- append-only 审核证据；
- 不可变快照持久化；
- 治理 Unit of Work Port；
- Registry 与审核决定的单数据库事务组合；
- durable adapter 合同与并发测试。

暂不允许：

- HTTP API；
- 登录和 RBAC 管理后台；
- AI 自动审核或发布；
- k6 Worker 或生产测试执行。
