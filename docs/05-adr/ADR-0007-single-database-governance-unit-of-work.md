# ADR-0007：单数据库 Governance Unit of Work

- 状态：Accepted
- 日期：2026-07-27

## 背景

M1-C 的 Registry、审核决定和快照 Store 是独立 Port。若持久化实现分别开启事务，REQUEST_CHANGES 可能只保存审核决定却没有退回草稿，发布也可能在审核证据读取和状态转换之间产生竞争窗口。

## 决策

1. 新增 `GovernanceUnitOfWorkPort`；
2. 治理服务的写操作均通过 Unit of Work 获取 Registry、Review Store 和 Snapshot Store；
3. PostgreSQL UoW 使用一个 Pool client 和一个事务；
4. PostgreSQL Registry 支持绑定外部 client，绑定后不得开启嵌套事务或释放 client；
5. 审核决定与快照 Store 同样支持 Pool 模式和 transaction-client 模式；
6. 授权可在事务前执行，事务内必须重新读取 record revision 并执行 CAS；
7. review decision 与 snapshot envelope 在数据库级禁止 UPDATE/DELETE。

## 结果

优点：

- 状态与证据原子提交；
- 不复制 Registry 生命周期逻辑；
- 同一适配器既可独立使用，也可加入 UoW；
- 并发发布由 row lock 和 CAS 收敛；
- 未来 HTTP 层无需了解事务细节。

代价：

- PostgreSQL Registry 构造方式增加 client 模式；
- 授权结果与数据库事务不是同一个原子资源；
- 跨数据库或外部证据系统仍需要更高层协调机制；
- 长事务必须通过应用层超时和监控治理。
