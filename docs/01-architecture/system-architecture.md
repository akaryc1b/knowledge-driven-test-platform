# 系统总体架构

## 逻辑架构

```text
知识来源
  ├─ PRD / OpenAPI / DDL / BPMN / IAM / CMDB / SLO
  └─ 缺陷 / 事故 / 历史测试证据
          │
          ▼
知识治理层
  ├─ 抽取、审核、版本、发布、废弃
  └─ 项目级权限与审计
          │
          ▼
边界解析层
  ├─ GLOBAL
  ├─ DOMAIN
  ├─ PROJECT
  ├─ ENVIRONMENT
  └─ RELEASE
          │
          ▼
不可变知识快照
          │
          ▼
测试规划与执行
  ├─ API / 性能 / Browser / WebSocket
  └─ 数据库 / 中间件 / 可靠性
          │
          ▼
证据与覆盖治理
```

## 核心子系统

### Knowledge Registry

保存知识对象、版本、状态、所有者和关联关系。M0 先使用仓库文件，后续再建设服务化注册中心。

### Boundary Resolver

按固定优先级组合规则，执行覆盖约束，输出唯一有效边界。

### Snapshot Builder

规范化解析结果并生成 SHA-256 标识，保证同一输入得到同一快照。

### Test Planner

根据有效边界生成测试矩阵、风险优先级和执行计划。M0 只预留接口。

### Execution Adapters

后续对接 k6 API、性能、Browser、WebSocket 和扩展能力。

### Evidence Store

保存快照、执行结果、覆盖信息和报告。M0 只定义证据契约。

## 架构约束

- 正式执行必须携带 `projectId`、`environmentId`、`releaseId` 和 `snapshotId`；
- 测试只能消费已发布知识；
- 全局强制规则不能被项目关闭；
- 解析过程必须确定性、无网络依赖；
- 快照 ID 不能包含生成时间等非确定性字段。
