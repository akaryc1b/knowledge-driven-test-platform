# M2-RC1 Release Readiness Roadmap

## 当前权威结论

M2-RC1 的仓库级目标是 Portable Release Readiness，不是替任意部署方完成固定生产环境上线。

```text
repositoryReleaseReady=true
environmentPromotionEvaluated=false
environmentPromotionEligible=null
repositoryBlockers=[]
```

## 已完成的历史切片

### R0 — Production Promotion Contract

完成并已合并。建立历史 Promotion、main CI 观察和 blocker 推导模型。

### R1-A — Immutable GHCR Image Release

完成。真实发布 Workflow Run `30440674461`，Registry digest 为 `sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13`，SBOM、Provenance 和 SBOM Attestation 完整。

### R1-B — Immutable Image Binding

完成并已合并。Deployment 使用完整 `@sha256:` 引用，镜像与 Manifest digest 绑定完成。

### R2-A — External Evidence Intake

完成并已合并。Secret、Cluster 和 Approval 输入合同继续作为部署方可选能力保留，不再是仓库发布必需条件。

### R2-Rebaseline — Portable Release Readiness

完成并已合并。精确 main Merge SHA：`70b06e28e48c38d8b7feed29177144d35cb96069`。

交付：

1. `m2-portable-release-readiness/v1`；
2. 历史 Promotion、R2-A、R1-B 与 Deployment digest 防篡改；
3. Repository 与 Environment 决策分离；
4. Operator-supplied、Provider-agnostic Runtime Configuration；
5. Node、PostgreSQL 18、Docker 与永久 Artifact；
6. 精确 main-push 和只读观察验收。

## R3 — Final Release Closure and M3 Entry Gate

状态：当前独立安全切片。

目标：

1. 新增 `m2-final-release-closure/v1`；
2. 固化 PR #38 的精确 main-push Run、Job 和 Artifact；
3. 固化控制 PR #39 的只读观察 Artifact；
4. 修正 M2-H、堆叠未合并和旧 Production 资格表述；
5. 确定性声明 `m2Rc1Closed=true`；
6. 开放 `M3-R0` 规划入口，但保持 `m3ImplementationStarted=false`；
7. 提供 Validator、Node/PG18 回归、Docker hardened runtime 和永久 Artifact。

## M3-R0 入口边界

R3 通过并合并后，下一独立安全切片为 `M3-R0 — Execution Adapter Foundation`。

M3-R0 只建立合同，不调用 k6/xk6/Playwright，不创建 Worker、Queue、Scheduler 或 Kubernetes Job，不访问 Secret 或目标环境。

## 部署实例边界

真实运行时配置、占位值替换、目标环境验证和本地审批仍由部署方完成。缺少这些环境数据不能解释为仓库发布失败。

## 冻结范围

R3 不：

- 创建或读取 Secret；
- 访问或修改目标集群；
- 创建审批；
- 执行 rollout 或切流；
- 重建或重新发布镜像；
- 修改 Registry digest；
- 启动执行器实现或外部进程；
- 增加 Worker、Queue、Scheduler、Kubernetes Job；
- 自动合并任何 PR。
