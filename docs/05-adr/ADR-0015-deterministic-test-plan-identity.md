# ADR-0015：正式测试计划使用确定性身份与执行器无关合同

- 状态：Accepted
- 日期：2026-07-27

## 背景

M1 已能发布知识并生成不可变快照。M2 需要把这些输入转换为正式测试计划。如果计划或意图使用随机 UUID、隐式读取最新知识、当前时间、非稳定数组顺序或执行器脚本，相同发布输入将无法重现同一规划结果，也无法可靠审核 Coverage 与 Provenance。

## 决策

1. 正式计划只绑定 `PUBLISHED` Knowledge 的不可变 Snapshot Envelope；
2. Snapshot ID 与 SHA-256 digest 同时进入规划 fingerprint；
3. `planId` 从完整规范化规划输入确定性派生；
4. `intentId` 从计划输入、Target、Capability 和来源知识确定性派生；
5. canonical JSON、稳定排序和 SHA-256 是所有正式 digest 的唯一基础；
6. 时间戳、随机数、数据库序列和对象插入顺序不得参与正式身份；
7. Test Intent 只描述目标、输入、断言、阈值和依赖，不携带 k6、Playwright、SQL 或其他执行器脚本；
8. Secret、Token、私钥、连接串和运行节点信息在合同入口即被拒绝；
9. 所有输入和输出均 defensive copy；
10. 运行时验证与 JSON Schema 使用相同版本化合同和稳定错误码。

## 结果

优点：

- 相同输入可产生完全相同的计划和意图身份；
- 审核、冻结、缓存、去重和后续执行绑定可使用稳定 digest；
- Planner 与执行器职责分离；
- Provenance 可以精确指向 Snapshot、知识版本、Capability 与 Target；
- 计划证据不需要保存敏感运行配置。

代价：

- 所有参与身份的数组必须定义明确排序规则；
- 合同变更必须通过新 Schema 版本演进；
- 人工编辑不能绕过规范化和重新计算 fingerprint；
- 后续执行阶段需要单独把 Intent 编译为执行器任务。
