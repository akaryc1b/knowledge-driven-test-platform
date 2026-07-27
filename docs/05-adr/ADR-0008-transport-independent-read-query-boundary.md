# ADR-0008：运输无关的只读查询边界

- 状态：Accepted
- 日期：2026-07-27

## 背景

Registry、治理证据和快照已经可以持久化，但直接把 Adapter 暴露给 HTTP 会泄漏内部模型，并把认证、项目隔离、分页和错误语义分散到不同控制器。

## 决策

1. 先建立 `@kdtp/governance-query` 应用包；
2. Handler 不绑定任何 HTTP 框架，只返回 `{status, body}`；
3. 请求身份通过 `RequestIdentityContextPort` 解析；
4. 查询服务再次执行项目级治理授权；
5. 只暴露稳定 DTO，不返回数据库行；
6. 项目知识查询只允许匹配项目的 PROJECT scope；
7. 分页 cursor 与规范化查询指纹绑定；
8. 未知内部错误必须脱敏；
9. 写入命令不进入本包。

## 结果

优点：

- 后续可接入 Node HTTP、Serverless、MCP 或内部网关；
- 项目隔离与错误语义可独立测试；
- 存储模型不会成为外部契约；
- 身份验证实现可替换；
- 只读和写入攻击面保持分离。

代价：

- 需要显式 DTO 映射；
- cursor 不是数据库原生游标；
- 共享知识项目视图需要后续模型；
- HTTP Adapter 仍需独立安全切片。
