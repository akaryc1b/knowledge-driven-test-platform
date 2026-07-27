# M1-D 当前开发交接

## M0 已完成

- 多项目五层知识模型；
- 规则解析、受控覆盖和不可变快照；
- 审批示例、CLI、测试和 CI。

## M1-A 已完成

- 版本化知识 Schema；
- Registry Port、内存适配器和合同测试；
- revision CAS、生命周期和审计历史。

## M1-B 已完成

- PostgreSQL Registry Adapter；
- checksum migration、事务、advisory lock、row lock 和 CAS；
- append-only Registry 历史与真实 PostgreSQL CI。

## M1-C 已完成

- 项目级授权 Port；
- 作者、审核人和发布人职责分离；
- revision 绑定审核决定；
- 风险分级发布策略；
- 审计查询与不可变快照 Store Port。

## M1-D 已完成

- 独立 `@kdtp/knowledge-governance-postgres` package；
- PostgreSQL review decision 与 snapshot envelope 持久化；
- review evidence append-only 数据库保护；
- snapshot envelope immutable 数据库保护；
- snapshot digest、ID 和上下文关系约束；
- checksum governance migration；
- PostgreSQL Governance Unit of Work；
- Registry、review Store 和 snapshot Store 绑定同一 transaction client；
- Governance Service 通过可替换 Unit of Work 执行写操作；
- PostgreSQL Registry 支持外部 transaction client；
- REQUEST_CHANGES 决策与 Registry 转换原子提交；
- 发布证据读取与 Registry 发布原子提交；
- migration 回滚、并发审核和并发发布测试；
- durable adapter 合同与重启恢复测试。

## 当前边界

- Registry 与治理证据均可持久化到 PostgreSQL；
- 同一数据库内的治理写操作可原子提交；
- 项目授权仍由调用方提供，当前只有内存示例适配器；
- Resolver 仍从项目 JSON 文件加载知识；
- 没有 HTTP 服务、身份认证、RBAC 管理后台或组织同步；
- 没有自动废弃旧版本；
- 没有 k6 Worker、队列或生产执行。

## 下一安全切片

`M1-E — Read-Only Governance Query API`

只允许：

- 只读应用服务边界；
- 项目知识、审核时间线和快照查询 DTO；
- 显式请求身份上下文 Port；
- 分页、过滤和稳定错误映射；
- 内存 HTTP-free handler 合同测试。

暂不允许：

- 写入 HTTP API；
- 登录和 RBAC 管理后台；
- AI 自动审核或发布；
- k6 Worker 或生产执行。
