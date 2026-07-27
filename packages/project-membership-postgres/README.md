# @kdtp/project-membership-postgres

M1-F 的 PostgreSQL 项目目录、成员 Store 和读取授权适配器。

能力：

- checksum migration；
- 项目和成员关系持久化；
- append-only 审计历史；
- row lock 与 revision CAS；
- 单事务项目/成员读取授权；
- 并发更新和数据库防篡改测试。

应用组合根负责创建并关闭 PostgreSQL Pool。
