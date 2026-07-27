# Versioned Knowledge Schemas

`schemas/knowledge/schema-catalog.json` 是知识 Schema 的稳定入口。

当前版本：

- `knowledge-rule/v1` → `knowledge/v1/knowledge-rule.schema.json`
- `knowledge-registry-record/v1` → `registry/v1/knowledge-registry-record.schema.json`

Schema 版本只允许追加。已发布 Schema 不得原地修改破坏兼容性；不兼容变更必须创建 `v2`，并在后续安全切片中提供显式迁移。

## M2 规划合同

`schemas/planning/` 固定规划请求、目标清单、测试意图、覆盖义务和正式测试计划的 v1 合同。规划合同只描述执行器无关意图，不保存脚本、凭证或运行节点。
