# M1-B 当前开发交接

## M0 已完成

- 多项目五层知识模型；
- 规则运行时校验与受控覆盖；
- 解析来源链；
- 规范化 JSON 与 SHA-256 快照；
- 审批平台示例、CLI、单元测试和 CI。

## M1-A 已完成

- `knowledge-rule/v1` 与 Registry Record Schema；
- 逻辑 ID、严格 SemVer 和追加式版本；
- 异步 Registry Port；
- 内存适配器；
- revision CAS；
- 治理生命周期和审计历史；
- 可复用 Registry 合同测试。

## M1-B 已完成

- 独立 `@kdtp/knowledge-registry-postgres` package；
- PostgreSQL 18 数据模型；
- knowledge record 与 audit history 分表；
- SemVer 数字段与稳定排序索引；
- JSONB 正文与关系字段一致性约束；
- checksum migration runner；
- migration advisory lock 与事务回滚；
- 同一知识 ID 创建 advisory lock；
- row lock 与 revision CAS；
- 只读 repeatable-read hydration；
- 数据库错误到稳定 RegistryError 的映射；
- 审计历史数据库级 append-only 保护；
- Docker Compose 本地数据库；
- GitHub Actions PostgreSQL 集成测试；
- 与内存适配器相同的 Registry 合同测试。

## 当前边界

- Registry 已有内存与 PostgreSQL 两种适配器；
- Resolver 仍从项目 JSON 文件直接装载 PUBLISHED 规则；
- PostgreSQL Pool 由应用组合根创建和关闭；
- 没有 HTTP 服务、UI、认证和项目成员授权；
- 没有审核决策对象或发布前策略检查；
- 没有快照持久化；
- 没有自动废弃旧版本或跨知识对象业务事务；
- 没有 k6 Worker、队列或生产执行。

## 下一安全切片

`M1-C — Governance Service Boundary`

只允许：

- 项目级授权端口；
- 审核决策对象；
- 发布前策略检查；
- 审计查询模型；
- 快照持久化端口；
- 内存实现与合同测试。

暂不允许：

- HTTP API；
- 登录、RBAC 管理后台或组织同步；
- AI 自动审核或发布；
- k6 Worker 或生产执行。
