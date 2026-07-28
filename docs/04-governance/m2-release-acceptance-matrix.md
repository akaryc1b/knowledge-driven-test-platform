# M2 发布验收矩阵

| 领域 | 必须证据 | 当前候选 |
|---|---|---|
| 确定性 | 相同输入得到相同 Plan ID、digest、Coverage、Provenance 和 DAG | 必须通过 |
| 持久化 | migration checksum、CAS、锁、并发、重启恢复和数据库防篡改 | 必须通过 |
| 治理 | revision-bound review、职责分离、Coverage Gate、双审核和 Freeze Gate | 必须通过 |
| 原子性 | 计划、审核证据和 lifecycle 同事务提交或回滚 | 必须通过 |
| 查询 | 五条 Test Plan GET 路由、项目隔离和稳定 cursor | 必须通过 |
| 服务 | 五条 Knowledge + 五条 Test Plan 路由共享认证、授权、Pool 和探针 | 必须通过 |
| 故障 | PostgreSQL/JWKS 故障撤销 readiness，恢复无需重启 | 必须通过 |
| 安全 | 401/403/405、限流、安全 Header、证据无秘密材料 | 必须通过 |
| 发布 | 八个堆叠 PR、Schema/Manifest digest、M1 与 M2 独立证据 | 必须通过 |
| 生产资格 | 外部镜像、Secret、集群、审批、合并后 main CI | 当前阻断 |
