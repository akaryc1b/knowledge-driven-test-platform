# M3-R2-P5 Source Generation Threat Model

## 信任边界

P5 不信任当前 Head 临时生成的前任 Evidence。唯一可信输入是永久 accepted-P4 receipt 及其中固定的 accepted-P3 外部信任锚。每个原始文件摘要、Git blob SHA、canonical digest、Head、Run、Artifact、Source、Manifest、Bundle、Receipt 和 Publication Evidence 都必须独立复核。

## 主要威胁

- 修改 Source 后重算全部内部摘要；
- 跨 project/environment/plan/snapshot/capability 拼接；
- eval、Function、node:vm、动态 import、require、child_process、process.env、回调或脚本注入；
- 路径穿越、绝对/UNC/drive/file URI、NUL、编码穿越、符号链接和调用方文件名；
- Header、Cookie、Token、密钥、JWT、连接串、凭据路径进入输出；
- staging/rename/Receipt 故障留下半成品；
- 并发覆盖内容寻址 Store；
- 将本地 `artifactPublished=true` 误表述为远程发布或执行。

## 控制

P5 使用独立 canonical JSON/SHA-256/Git blob 实现、固定文件白名单、字节读回、静态扫描、外部锚比较及 fail-closed 持久化测试。测试 fixture 通过分段拼接构造 credential shape，不把疑似真实凭据写入永久 Artifact。

```text
sourceExecuted=false
remoteArtifactPublished=false
nextRequiredSlice=M3-R2-G1
```
