# M1-B — Durable Registry Adapter

## 目标

为 M1-A 的 `KnowledgeRegistryPort` 提供 PostgreSQL 持久化实现，使知识记录、版本、revision 和审计历史在进程重启后仍可恢复，并保持与内存适配器相同的领域行为。

本切片只建设持久化边界，不开放 HTTP API、认证、管理后台或生产测试执行。

## 允许范围

- PostgreSQL 18 本地与 CI 测试环境；
- 版本化 SQL migration；
- migration checksum 与重复执行保护；
- knowledge record、SemVer 分段、scope、status 和 revision 持久化；
- 审计历史独立追加存储；
- PostgreSQL Registry Adapter；
- transaction、row lock、revision CAS；
- 同一知识 ID 新版本创建的事务级串行化；
- 唯一约束、检查约束和索引；
- 复用 M1-A Registry 合同测试；
- 数据库错误到稳定 RegistryError 的映射；
- Docker Compose 本地数据库配置；
- GitHub Actions PostgreSQL 集成测试。

## 明确不做

- 对外 HTTP API；
- 登录、RBAC、项目成员或租户授权；
- 管理后台；
- AI 自动审核、发布或迁移；
- 自动废弃旧版本；
- 跨知识对象业务事务；
- 生产数据库部署工具；
- 读写分离、分片、多区域复制；
- k6 Worker、队列或生产测试执行。

## 数据模型

### knowledge_records

保存每个 `id@version` 的当前状态：

- `record_key`：`id@version` 主键；
- `knowledge_id` 和 `knowledge_version`：稳定身份；
- `version_major/minor/patch`：正确 SemVer 排序；
- `status`、`scope_level`、`scope_key`：高频过滤字段；
- `revision`：乐观并发控制；
- `knowledge`：完整 `knowledge-rule/v1` JSONB；
- `created_at`、`updated_at`：审计时间。

### knowledge_history

每次写操作追加一个事件：

- `(record_key, sequence)` 复合主键；
- `event_type`；
- `from_status`、`to_status`；
- `actor`、`occurred_at`、`reason`。

历史表禁止 UPDATE 和 DELETE。记录表禁止改变身份、倒退 revision 或倒退更新时间。

## 并发模型

### 创建新版本

同一 `knowledge_id` 的创建事务先获取 transaction-scoped advisory lock，再读取最高 SemVer 并插入。该锁只在事务内存在，防止两个并发请求都通过“最高版本”检查。

### 更新与状态转换

1. `SELECT ... FOR UPDATE` 锁定目标记录；
2. 使用 M1-A 纯领域函数计算下一状态；
3. `UPDATE ... WHERE revision = expectedRevision` 执行 CAS；
4. 追加下一条审计历史；
5. 同一事务提交。

### 读取

多查询读取在只读 `REPEATABLE READ` 事务中完成，确保记录与历史属于同一数据库快照。

## Migration 规则

- migration 文件采用递增编号和不可变 SQL；
- migration runner 使用全局事务级 advisory lock；
- 已应用 migration 保存 SHA-256 checksum；
- 同版本 checksum 变化必须失败；
- migration 在单一事务中执行；
- 应用失败必须回滚，不能留下半迁移状态。

## 验收标准

- migration 可在空数据库中成功应用；
- migration 重复应用不产生重复对象；
- migration checksum 被修改时稳定失败；
- PostgreSQL Adapter 通过完整 Registry 合同测试；
- 并发重复版本创建只有一个成功；
- 并发低版本创建不会绕过单调版本约束；
- stale revision 更新被拒绝；
- 失败事务不追加审计历史；
- 已发布知识不可替换；
- 进程重新创建 Adapter 后仍能读取原记录；
- 列表和版本顺序与内存适配器一致；
- M0、M1-A 单元测试继续通过；
- CI 在真实 PostgreSQL 服务上运行集成测试。

## 后续安全切片

`M1-C — Governance Service Boundary`

只允许：

- 项目级授权端口；
- 审核决策对象；
- 发布前策略检查；
- 审计查询；
- 快照持久化端口。
