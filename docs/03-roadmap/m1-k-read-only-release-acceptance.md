# M1-K — Read-Only Release Acceptance and Stack Consolidation

## 目标

将 M1-A～M1-J 的独立安全切片收敛为一个可验证、可审计但尚未生产晋级的只读发布候选。

## 本轮能力

- 版本化 M1-RC1 候选定义；
- PR #1～#10 堆叠顺序和 head SHA 记录；
- 发布候选和部署 Manifest digest；
- 真实 PostgreSQL + JWKS + OIDC JWT + 成员授权 + HTTP 查询端到端测试；
- 五条只读业务路由验收；
- 未认证与跨项目拒绝验收；
- 镜像 ID、Registry digest 和部署证据模型；
- 安全、故障、可观测性和运维验收矩阵；
- M1 Changelog、已知风险和正式完成条件。

## 堆叠策略

M1-K 不自动合并 PR。候选记录固定以下顺序：

```text
PR #1 → #2 → #3 → #4 → #5 → #6 → #7 → #8 → #9 → #10
```

每个 PR 的 base 必须等于前一切片 head。合并时从 PR #1 开始，完成一次后再重新确认下一 PR 的 base、CI 和差异范围。

## 端到端验收

真实验收使用 PostgreSQL 18 服务和临时 JWKS HTTP Server：

1. 应用执行三组 migration；
2. 创建项目、VIEWER 成员、已发布知识、审核决定和快照；
3. 生成 2048-bit RSA 密钥并签发 RS256 JWT；
4. 服务从 JWKS 获取公钥并完成 subject → actor 映射；
5. 成员授权允许当前项目读取；
6. 五条业务路由全部返回 200；
7. 缺少 Token 返回 401；
8. 访问未授权项目返回 403；
9. 响应和运行事件不得包含凭证或密钥材料。

## 发布证据

候选证据包含：

- source commit 与 branch；
- stack digest；
- Kubernetes Manifest digest；
- 本地容器 image ID；
- 可选外部 registry digest；
- 测试、路由、安全和故障控制结果；
- productionEligible 与 blockers。

本地 image ID 不能替代外部 Registry digest。

## 明确不包含

- 自动合并 PR；
- 自动推送镜像或部署集群；
- 真实生产 Secret；
- 写入 HTTP API；
- M2 Test Planning；
- k6 Worker、队列或生产测试执行。
