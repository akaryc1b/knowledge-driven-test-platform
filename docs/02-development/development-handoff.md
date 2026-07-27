# M1-E 当前开发交接

## M0 已完成

- 多项目五层知识模型；
- 规则解析、受控覆盖和不可变快照；
- 审批示例、CLI、测试和 CI。

## M1-A 至 M1-D 已完成

- 版本化 Registry 领域边界；
- PostgreSQL Registry、CAS、锁和 append-only 历史；
- 项目授权、职责分离和 revision 绑定审核；
- PostgreSQL 审核证据与不可变快照；
- 单数据库 Governance Unit of Work；
- 原子退回、发布与并发保护。

## M1-E 已完成

- 独立 `@kdtp/governance-query` package；
- 显式 Request Identity Context Port；
- 内存身份上下文适配器；
- 项目知识列表与详情 DTO；
- 审核时间线 DTO；
- 快照列表与详情 DTO；
- `KNOWLEDGE_READ` 项目动作；
- 项目级查询授权和范围隔离；
- GLOBAL、DOMAIN 与其他项目知识默认不可见；
- 过滤、稳定排序和最大 100 条分页；
- 与查询指纹绑定的 opaque cursor；
- stale cursor 和 query mismatch 检测；
- HTTP-free Handler；
- 稳定成功与错误 response envelope；
- 401、403、404、409 与 500 映射；
- 未知内部错误消息脱敏；
- Query JSON Schema、示例和合同测试。

## 当前边界

- Query Handler 不启动 HTTP 服务；
- 身份 Port 接收调用方提供的 credential context，不验证真实 Token；
- 当前项目查询仅暴露 PROJECT scope 知识；
- 共享 GLOBAL 和 DOMAIN 知识需要后续显式项目绑定视图；
- 分页 cursor 对当前查询结果锚点敏感，锚点删除后返回 `CURSOR_STALE`；
- Registry 与治理证据均可使用内存或 PostgreSQL Adapter；
- 没有写入 HTTP API、登录系统、RBAC 管理后台或生产执行。

## 下一安全切片

`M1-F — Durable Project Membership and Read Authorization`

只允许：

- 项目目录与成员关系 Port；
- 项目角色到治理动作映射；
- PostgreSQL 项目成员 Adapter；
- deny-by-default 授权；
- 成员状态、停用和项目隔离；
- 查询权限合同与并发测试。

暂不允许：

- OAuth/OIDC 登录；
- 写入 HTTP API；
- 管理后台；
- AI 自动审核或发布；
- k6 Worker 或生产执行。
