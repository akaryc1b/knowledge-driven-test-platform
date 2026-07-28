# ADR-0021：Project-Isolated Read-Only Test Plan Queries

- 状态：Accepted
- 日期：2026-07-28

## 背景

M2-F 已提供持久化、治理和事务化规划工作流，但直接返回 Registry Record 或让 HTTP Transport 访问 PostgreSQL 会泄漏存储结构、绕过项目授权，并把认证、安全 Header 和错误策略复制到新的计划接口。

## 决策

1. 新增运输无关 `test-plan-query` 应用边界；
2. 查询服务只依赖 Test Plan Registry read port、Plan Governance authorization 和 Request Identity Context；
3. 查询结果映射为稳定 DTO，不返回数据库行或 input fingerprint；
4. 所有查询显式绑定 `projectId`，跨项目记录按不存在处理；
5. `PLAN_READ` 保护 list/detail/coverage/provenance，`PLAN_AUDIT_READ` 保护 timeline；
6. list cursor 绑定项目、过滤、排序和方向的 SHA-256 指纹；
7. 新增 `test-plan-http` 路由适配层，但复用 M1 已有 AuthenticationPort、限流、Request ID、安全 Header 和错误脱敏语义；
8. 已知计划路由只允许 GET，所有写方法稳定返回 405；
9. Coverage、Provenance 和 timeline 必须来自同一当前 plan revision；
10. 该边界不调用 Planner，不执行 Governance 命令，也不包含测试执行能力。

## 结果

优点：计划查询保持项目隔离、协议稳定和运输无关，HTTP 安全规则与 M1 一致，未来 UI 或其他只读 Transport 可复用同一 Handler。

代价：需要额外 DTO 与 cursor 维护；服务组合根必须显式注入 Registry、授权、身份和 HTTP 依赖。
