# 多项目安全与隔离

## 权限模型

建议最小权限集合：

- `project.knowledge.read`
- `project.knowledge.edit`
- `project.knowledge.review`
- `project.knowledge.publish`
- `project.test.execute`
- `project.evidence.read`
- `global.rule.manage`

## 隔离要求

- 每个知识对象必须携带项目或全局命名空间；
- 项目凭据不得写入知识规则或快照；
- 环境绑定只保存凭据引用；
- 执行证据默认按项目隔离；
- 跨项目查询需要显式公司级权限；
- 领域能力包不得包含单个项目的敏感数据。

## 强制基线

项目不能关闭以下类型规则：

- 密钥和 Token 日志脱敏；
- 跨租户数据隔离；
- 高风险操作审计；
- 生产测试授权；
- 测试数据清理；
- P0 缺陷阻断。

## M0 限制

M0 只实现规则层面的项目作用域校验，不提供身份认证、服务端授权和密钥管理。
