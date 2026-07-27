# ADR-0013：安全 Kubernetes 只读部署基线

- 状态：Accepted
- 日期：2026-07-27

## 背景

M1-I 已提供可启动的只读服务、运维探针和优雅关闭，但缺少可审查的集群部署约束。若由环境临时拼装 Deployment，副本、探针、安全上下文、Secret 引用和终止时间可能产生不一致，破坏已有运行时合同。

## 决策

1. 仓库提供 Kubernetes Deployment、Service、ServiceAccount、ConfigMap、PDB 和 Kustomization 基线；
2. Manifest 使用 JSON-compatible YAML，由 Kubernetes 和 Node 原生解析器共同读取；
3. 默认运行两个副本，滚动更新使用 `maxUnavailable=0`、`maxSurge=1`；
4. `/live` 只用于 startup/liveness，`/ready` 只用于 readiness；
5. Pod 与容器均要求非 Root、RuntimeDefault seccomp、禁止提权、只读根文件系统和 Drop ALL；
6. ServiceAccount Token 不自动挂载；
7. ConfigMap 与 Secret 分离，示例 Secret 不进入默认 Kustomization；
8. 终止宽限期必须大于应用关闭上限；
9. 生产镜像必须在晋级阶段替换为不可变 digest；
10. PostgreSQL/JWKS 故障和 SIGTERM 行为由自动测试证明，而不是仅靠 Manifest 审查。

## 结果

优点：

- 部署约束可版本化和审计；
- 依赖故障不会触发错误重启循环；
- 滚动升级与主动中断保留可用副本；
- 容器权限面显著缩小；
- 不依赖第三方 YAML 解析库；
- 应用关闭合同与 Kubernetes 生命周期一致。

代价：

- JSON-compatible YAML 可读性低于手写 YAML；
- 生产环境仍需覆盖 OIDC 地址、Secret 和镜像 digest；
- 当前基线未包含 Ingress、NetworkPolicy、Helm 或自动部署；
- 两副本和资源限额需要环境容量支持。
