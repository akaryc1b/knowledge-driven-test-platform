# M3-R2-P5 — Source Generation Acceptance

P5 用独立 acceptance harness 复核 M3-R1 → P1 → P2 → P3 → P4 的完整证据链。产品身份只由规范化语义输入和固定前任信任锚决定，不受请求人、时间、CI Run、merge ref、临时目录、宿主路径或重复发布影响。

验收必须拒绝错绑、摘要替换、全链重哈希伪造、可执行材料、路径逃逸、符号链接、额外/缺失文件、credential-shaped material 和不完整 Store。并发只允许产生一个一致的内容寻址 Store；失败不得产生可接受 Receipt。

```text
sourceGenerationAcceptanceComplete=true
sourceExecuted=false
remoteArtifactPublished=false
nextRequiredSlice=M3-R2-G1
```

该状态只表示 P5 合同验收结束，不授权 Ready、merge、G1 或 M3-R3。
