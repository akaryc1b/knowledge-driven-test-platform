# @kdtp/knowledge-registry

M1-A 的知识注册领域边界与内存适配器。

## 能力

- `knowledge-rule/v1` 对象校验；
- 逻辑 ID 与严格 SemVer；
- 异步 Registry Port；
- 内存 Registry；
- revision CAS；
- 草稿替换；
- DRAFT、REVIEWING、PUBLISHED、DEPRECATED、ARCHIVED 生命周期；
- 防御性副本；
- 可复用适配器合同测试。

## 当前限制

- 不持久化；
- 不包含认证授权；
- 不保证跨进程并发；
- 不提供多记录事务；
- 不自动废弃旧发布版本。
