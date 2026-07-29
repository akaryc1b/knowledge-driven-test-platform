# M2-RC1 R0 Main CI Closure

## 目标

本切片在 R0 Production Promotion Contract 合并后，以追加证据核验精确的 R0 merge commit：

`edf09333d9be9ea6839b8cf4d18efed95cfba821`

该提交是 PR #22 的 merge commit，也是修复 push 环境 release evidence 分支归一化后的第一个 `main` 候选。

## 两阶段证据流程

1. 只读采集阶段：
   - PR runner 使用 `actions: read`；
   - 只查询上述 SHA 的 `push` Workflow；
   - 记录 run、job、Deployment Validator step 和该 run 实际生成的 Artifact digest；
   - 不修改 Production Promotion，不关闭 blocker。
2. 永久绑定阶段：
   - 仅在采集结果证明 run、Validate/PostgreSQL jobs、Deployment Validator 和所有强制 Artifact 均成功后进行；
   - 将真实 run ID 与 digest 追加绑定到 Production Promotion；
   - 添加独立 closure evidence 和 Validator；
   - `main-branch-final-ci-not-verified` 才允许关闭。

## 失败边界

如果 R0 merge commit 的 push run 缺失、失败、存在重复匹配、Artifact 不完整或 digest 无效：

- 采集 Workflow 必须失败或生成 `eligibleForClosure=false` 证据；
- 不得使用 PR Validation 替代 `main` push CI；
- 不得伪造或补写缺失 Artifact；
- `productionEligible` 必须保持 `false`。

## 明确不在范围内

- GHCR 发布与 Registry digest 绑定；
- R1-B Deployment 修改；
- Secret、目标集群和审批配置；
- 生产部署；
- M2-J、M3、Worker、Queue、Scheduler、Kubernetes Job、Allure、k6/xk6 或 Playwright。
