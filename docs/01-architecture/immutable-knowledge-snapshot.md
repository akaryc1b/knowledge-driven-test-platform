# 不可变知识快照

## 目的

知识库会持续变化，但测试结果必须能够说明“当时使用了哪一版规则”。因此，每次正式执行前必须解析并冻结知识快照。

## 快照内容

```json
{
  "snapshotId": "kb-approval-platform-0123456789ab",
  "context": {
    "projectId": "approval-platform",
    "environmentId": "staging",
    "releaseId": "M5-D6"
  },
  "rules": [],
  "resolution": [],
  "digest": "sha256..."
}
```

## 确定性要求

- 相同输入必须生成相同 `digest`；
- 创建时间可以作为外部元数据保存，但不得参与哈希；
- 快照一旦用于执行，不允许原地修改；
- 新规则发布后生成新快照，历史证据继续引用旧快照；
- 报告必须同时记录项目、环境、发布和快照 ID。

## 生命周期

```text
解析候选知识 → 校验 → 生成快照 → 执行绑定 → 证据归档
```
