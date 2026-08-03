# M3-R2-P5 Source Generation Acceptance Matrix

| ID | 控制 | 验收条件 |
|---|---|---|
| P5-01 | Accepted P4 | 原始 SHA-256、Git blob、canonical digest、Head、Run、Artifact 与分层摘要全部匹配 |
| P5-02 | Accepted P3 | Evidence、Source Artifact、Validation Evidence 与 Source digest 精确匹配独立信任锚 |
| P5-03 | Determinism | 字段/无序集合顺序、请求元数据、CI 元数据、路径、重复发布不改变产品摘要 |
| P5-04 | Binding | Request、Result、Artifact、Validation、P3、Bundle、Manifest、Receipt、Publication Evidence 任一错绑均拒绝 |
| P5-05 | Rehash forgery | Source 至 Publication Evidence 全部重哈希仍因外部锚不匹配而失败 |
| P5-06 | Injection | 执行材料、动态加载、Shell、Runtime 参数和调用方模块均不能进入接受链 |
| P5-07 | Persistence | 固定 8 文件、无路径逃逸、无符号链接、无额外/缺失/类型替换、无宿主路径泄漏 |
| P5-08 | Sensitive material | Source、Evidence、日志、Artifact 与 Store 的 credential-shaped scan 为零发现 |
| P5-09 | Non-execution | 不执行 Source，不调用 k6/xk6/Playwright，不访问目标网络、数据库或 Secret |
| P5-10 | Compatibility | M3-R0、M3-R1、P1-P4、M2、Node 22、PostgreSQL 18 与固定 Schema digest 均通过 |
| P5-11 | Fault/concurrency | 首次、幂等重复、并发、漂移、staging、缺失 Receipt、文件系统故障均 fail closed |
| P5-12 | Permanent evidence | exact-Head Workflow、P5/PostgreSQL Artifact、独立下载复算和永久 PR 评论完成 |

```text
sourceExecuted=false
remoteArtifactPublished=false
nextRequiredSlice=M3-R2-G1
```
