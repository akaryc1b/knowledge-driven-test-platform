# M2-D 当前开发交接

## M2-D 已完成

- 执行器无关 Test Plan Registry Port 与内存 Adapter；
- DRAFT、REVIEWING、APPROVED、FROZEN、SUPERSEDED、ARCHIVED 生命周期；
- DRAFT 内容替换、revision CAS 与不可变 Snapshot/Catalog binding；
- append-only history 和精确 plan revision review decision；
- PostgreSQL 18 Adapter、行锁、输入 fingerprint 唯一约束和 restart recovery；
- checksum migration、幂等、整体回滚和外部 transaction client 绑定；
- 数据库触发器保护生命周期、FROZEN 内容、身份绑定和历史证据；
- 并发创建、并发状态转换和防篡改合同测试；
- 本地干净安装回归为 228 项测试、223 通过、5 项仅因未配置 PostgreSQL URL 跳过；
- M1 全量回归、部署和 Release Validator 保持不变。

## 当前边界

- Registry 只提供低层状态原语，不决定谁可以审核、批准或冻结；
- Review Decision 已耐久绑定精确 revision，但职责分离与 Coverage Gate 尚未应用；
- 没有 HTTP 写路由、执行器、Worker、Queue、Scheduler、Kubernetes Job 或 M3。

## 同批次下一切片

`M2-E — Plan Governance and Review`

只允许：

- 计划治理动作和项目角色映射；
- 作者、审核人、冻结人职责分离；
- revision-bound review decision 和失效规则；
- Mandatory Coverage、EXEMPT evidence、风险双审核与 Freeze Gate；
- 治理审计时间线与共享合同测试。

M2-E 通过后自动继续 M2-F。
