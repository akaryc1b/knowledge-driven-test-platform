# ADR-0005 — PostgreSQL Durable Registry Adapter

- 状态：Accepted
- 日期：2026-07-27

## 背景

M1-A 已经建立异步 Registry Port、纯领域生命周期和内存适配器，但所有记录在进程退出后丢失。M1-B 需要增加生产形态的持久化边界，同时不能让数据库实现污染领域规则。

## 决策

采用 PostgreSQL 作为首个 durable adapter：

1. `@kdtp/knowledge-registry` 继续保持零数据库依赖；
2. 新建独立包 `@kdtp/knowledge-registry-postgres`；
3. Adapter 接收兼容 node-postgres Pool 的结构化对象，不在核心包内部创建全局连接；
4. 写操作通过同一 client 执行显式 BEGIN、COMMIT 和 ROLLBACK；
5. 同一知识 ID 的版本创建使用 transaction-scoped advisory lock；
6. 记录更新使用 row lock 加 revision CAS；
7. 知识正文存为 JSONB，高频过滤和 SemVer 排序字段关系化；
8. 审计历史独立追加保存，数据库层禁止 UPDATE 和 DELETE；
9. migration 通过 checksum 管理，不允许静默修改已应用 migration；
10. PostgreSQL Adapter 必须运行与内存 Adapter 相同的合同测试。

## 原因

- PostgreSQL 能同时提供事务、唯一约束、行锁、advisory lock、JSONB 和成熟运维能力；
- 关系字段保证稳定过滤和正确版本排序，JSONB 保留知识对象的可扩展性；
- 复用纯领域函数可以避免数据库层复制生命周期规则；
- 注入 Pool 而不是在包内读取环境变量，便于测试、连接治理和未来托管环境；
- 合同测试保证适配器替换不改变上层语义。

## 后果

### 正面

- Registry 可跨进程恢复；
- 并发约束由事务和数据库约束共同保护；
- 审计历史具备持久证据；
- 未来可以在不改领域模型的情况下增加其他 durable adapter。

### 代价

- 本地完整集成测试需要 PostgreSQL；
- migration 和连接池需要独立运维；
- JSONB 与关系列必须保持一致；
- 适配器需要稳定映射数据库错误，避免泄露驱动细节。

## 不选方案

- SQLite：并发和生产部署模型不符合当前目标；
- 仅存整条 JSON：难以用约束保证身份、版本和过滤行为；
- ORM：当前模型较小，直接 SQL 更容易审计事务和锁语义；
- 在核心 Registry 包直接依赖 `pg`：会破坏端口与适配器隔离。
