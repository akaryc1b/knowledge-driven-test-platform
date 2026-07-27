# 知识分层与解析

## 有效边界公式

```text
公司基线 + 领域能力包 + 项目边界 + 环境覆盖 + 发布覆盖 = 有效知识快照
```

## 规则标识

每条规则包含：

- `id`：全局唯一知识 ID；
- `boundaryKey`：用于识别同一逻辑边界的稳定键；
- `scope`：规则作用域；
- `enforcement`：mandatory、default 或 optional；
- `overridePolicy`：deny、strengthen 或 allow；
- `version`：规则版本；
- `enabled`：是否生效；
- `value`：结构化规则值；
- `owner`、`source` 和 `riskLevel`。

## 覆盖策略

### deny

高层规则只能重复相同值，不能修改、关闭或删除。

### strengthen

高层规则只能声明 `overrideIntent=strengthen`，且不能关闭规则。M0 只验证声明和结构，领域语义上的“更严格”由专用校验器逐步补充。

### allow

高层规则可以替换规则值，但仍必须满足强制级别和作用域约束。

## 同层冲突

同一层出现相同 `boundaryKey` 且值不同，解析器必须失败，禁止依赖文件顺序产生结果。领域能力包冲突需要在项目清单中显式处理，而不是静默覆盖。

## 确定性

- 规则输入顺序不影响结果；
- 领域包按稳定 ID 排序；
- 最终规则按 `boundaryKey` 排序；
- 对象键使用规范化顺序；
- 快照哈希不包含时间戳。
