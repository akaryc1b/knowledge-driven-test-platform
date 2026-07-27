# @kdtp/knowledge-core

零外部依赖的多项目知识边界核心。

## 能力

- 规则和上下文校验；
- GLOBAL、DOMAIN、PROJECT、ENVIRONMENT、RELEASE 五层解析；
- deny、strengthen、allow 覆盖策略；
- 同层冲突检测；
- 确定性规范化 JSON；
- SHA-256 不可变知识快照。

## 当前限制

`strengthen` 目前保证覆盖声明、不可关闭以及治理元数据不降级，但无法理解所有业务值的强弱语义。后续由具体规则类型的语义校验器补充。
