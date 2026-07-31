# 总体路线图

## M0 — Knowledge Foundation

- Monorepo 与开发基线；
- 多项目知识模型；
- 分层规则解析；
- 不可变知识快照；
- 示例项目和 CI。

状态：完成。

## M1 — Registry and Governance

- 知识注册服务；
- 草稿、审核、发布、废弃；
- 项目权限和审计；
- JSON Schema 与版本迁移；
- 快照持久化。

状态：完成并形成 M1-RC1。

## M2 — Test Planning

- 边界到测试矩阵；
- 风险优先级；
- 变更影响分析；
- 覆盖缺口和孤儿测试识别；
- Durable Registry、Governance、Orchestration 与只读查询；
- 不可变镜像和 Portable Release Readiness。

状态：M2-RC1 仓库级发布收口完成。

## M3 — k6 Execution Adapters

M3-R0 Contract Foundation 已完成精确 main 验收。当前切片为 `M3-R1 — Deterministic Non-Executing k6 API Spec Compiler`。

- Adapter、Request、Failure、Result 与 Evidence 合同；
- API 自动化；
- 接口性能；
- Browser；
- WebSocket；
- xk6 扩展绑定；
- 统一报告和证据。

M3-R1 只生成中立、不可执行的结构化 IR，不调用 k6，不生成可运行 JavaScript，不导入外部进程，不访问目标环境，不创建 Worker/Queue/Scheduler。受控 source generation 或 runtime boundary 只能在 M3-R2 独立评审。

## M4 — Multi-Project Operations

- 项目配置中心；
- 环境和凭据绑定；
- 执行队列与 Worker；
- 多项目看板；
- 资源配额和隔离。

## M5 — AI-Assisted Knowledge and Testing

- PRD/OpenAPI/DDL 候选知识提取；
- 测试草案生成；
- 失败归因；
- 人工审核闭环；
- AI 操作审计和安全边界。
