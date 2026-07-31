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

M3-R0 Contract Foundation 与 M3-R1 Deterministic Non-Executing k6 API Spec Compiler 已完成精确 main 验收。M3-R2-R0 已完成 Source Generation Boundary 与 Threat Model；M3-R2-P1 已完成 Versioned Source Generation Contracts and Schemas。

- Adapter、Request、Failure、Result 与 Evidence 合同；
- API 自动化；
- 接口性能；
- Browser；
- WebSocket；
- xk6 扩展绑定；
- 统一报告和证据。

M3-R2-P1 只增加固定 Canonical Rendering Policy、`CONTRACT_ONLY` Generator Descriptor、digest-bound Source Generation Request、严格 Schema、测试、Validator 与永久 Workflow。P1 不包含 renderer，不生成 JavaScript，不调用 k6，不启动 Runtime，不访问目标环境，不创建 Worker/Queue/Scheduler。

```text
sourceGenerationContractReady=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
nextRequiredSlice=M3-R2-P2
```

M3-R2-P2 增加确定性、纯内存、未执行的 k6 JavaScript Source Renderer、严格 Source Result、静态安全验证和永久证据。P2 只生成规范化 Source 文本，不调用 k6/xk6/Playwright，不启动外部进程，不访问目标网络或 Secret，不收集 Runtime Result。

```text
deterministicSourceRendererReady=true
sourceGenerationStarted=true
sourceGenerated=true
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
nextRequiredSlice=M3-R2-P3
```

P3–P5 必须继续按独立安全切片推进，M3-R3 仍保持冻结。

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
