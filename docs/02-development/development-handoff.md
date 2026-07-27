# M1-F 当前开发交接

## M0 至 M1-E 已完成

- 多项目五层知识边界、受控覆盖与不可变快照；
- Registry 领域边界、生命周期、CAS 与 PostgreSQL 持久化；
- 项目治理、职责分离、revision 绑定审核和发布策略；
- PostgreSQL 审核证据、不可变快照与单数据库 Unit of Work；
- 运输无关的知识、审核和快照只读查询边界；
- 请求身份 Port、项目隔离、DTO、游标分页与稳定错误 envelope。

## M1-F 已完成

- 独立 `@kdtp/project-membership` package；
- `ProjectDirectoryPort` 与 `ProjectMembershipPort`；
- 项目 ACTIVE、SUSPENDED、ARCHIVED 生命周期；
- 成员 ACTIVE、SUSPENDED、REVOKED 生命周期；
- VIEWER、AUTHOR、REVIEWER、PUBLISHER、AUDITOR、AUTOMATION 与 PROJECT_ADMIN 角色；
- 角色到治理动作的确定性映射；
- 成员生效时间与失效时间；
- deny-by-default `ProjectMembershipAuthorization`；
- 内存项目目录与成员 Store；
- 独立 `@kdtp/project-membership-postgres` package；
- PostgreSQL 项目、成员和 append-only 审计历史；
- revision CAS 与并发成员更新保护；
- 单事务 PostgreSQL 读取授权；
- migration checksum、回滚与真实 PostgreSQL 合同测试；
- Query Service 使用成员授权的组合示例。

## 当前边界

- 项目成员关系可以持久化并驱动现有治理和只读查询授权；
- 项目或成员缺失、暂停、撤销、未生效或过期均拒绝访问；
- 角色是平台固定基础角色，暂不支持项目自定义角色；
- 身份 Context 仍由调用方提供，不验证 OAuth/OIDC Token；
- 成员管理只有领域 Port 与 Adapter，没有 HTTP 写接口或管理 UI；
- 没有组织目录同步、SCIM、邀请流程或批量成员导入；
- 没有 k6 Worker、队列或生产执行。

## 下一安全切片

`M1-G — Read-Only HTTP Transport and Authentication Boundary`

只允许：

- 只读 HTTP 路由适配器；
- Bearer credential 提取 Port；
- 请求 ID、内容协商和响应头治理；
- 认证结果到 Request Identity Context 的组合；
- 只读速率限制 Port；
- HTTP 合同与安全测试。

暂不允许：

- 任何写入 HTTP API；
- 成员管理后台；
- 外部 IdP 管理或组织同步；
- AI 自动审核或发布；
- k6 Worker 或生产执行。
