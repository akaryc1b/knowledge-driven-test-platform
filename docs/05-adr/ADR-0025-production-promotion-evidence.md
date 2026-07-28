# ADR-0025：以追加证据而非改写历史完成生产晋级

- 状态：Accepted
- 日期：2026-07-28

## 背景

M2-RC1 已存在两份不同阶段的永久记录：合并前 candidate 与合并后 acceptance。生产晋级还依赖 GitHub Actions、GHCR、Artifact Attestation、Secret Provider、目标集群和审批系统中的真实外部事实。

把这些事实写回历史记录会改变既有 digest；让 Validator 主动查询外部系统则会使结果依赖网络、权限和短期状态，并诱发将查询失败误解释为成功的风险。

## 决策

新增第三阶段 `m2-production-promotion/v1` 记录和独立 evidence schema。

Production Promotion Validator：

- 重新读取并计算历史 candidate 与 post-merge acceptance digest；
- 只验证记录中声明的外部证据；
- 不主动访问 GitHub、Registry、Secret Provider、Kubernetes 或审批系统；
- 按固定规则从证据状态推导 resolved/open blockers；
- 拒绝占位 SHA、占位 digest、可变镜像标签、本地 Docker Image ID、示例审批号和敏感信息；
- 在任一强制 blocker 开放时拒绝 `productionEligible=true`。

R1-A 发布 Workflow 负责在受控、精确 SHA 的运行中获取 Registry digest、SBOM 和 Attestation。R1-B 只有在真实 digest 存在后才允许绑定 Deployment 与生产晋级记录。

## 结果

- 三个发布阶段可以独立审计；
- 外部权限不足时安全失败，不产生伪证据；
- Registry 标签不能替代不可变 digest；
- Secret 只保存 Provider 与引用，不保存值；
- 生产部署和目标集群验证仍需要显式授权；
- M2-J 与 M3 保持冻结。
