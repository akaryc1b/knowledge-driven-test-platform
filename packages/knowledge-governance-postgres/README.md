# @kdtp/knowledge-governance-postgres

M1-D 的 PostgreSQL 治理证据适配器。

- append-only review decisions；
- immutable snapshot envelopes；
- checksum migrations；
- PostgreSQL Governance Unit of Work；
- 与 Registry 共用一个 transaction client；
- durable adapter contracts 与并发测试。

该包不创建或关闭连接池，也不包含 HTTP、认证或管理后台。
