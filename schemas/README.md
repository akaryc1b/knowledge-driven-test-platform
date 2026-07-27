# Versioned Knowledge Schemas

`schemas/knowledge/schema-catalog.json` 是知识 Schema 的稳定入口。

当前版本：

- `knowledge-rule/v1` → `knowledge/v1/knowledge-rule.schema.json`
- `knowledge-registry-record/v1` → `registry/v1/knowledge-registry-record.schema.json`

Schema 版本只允许追加。已发布 Schema 不得原地修改破坏兼容性；不兼容变更必须创建 `v2`，并在后续安全切片中提供显式迁移。
