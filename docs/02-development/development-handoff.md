# M0 当前开发交接

## 已完成

- 多项目五层知识模型；
- 规则运行时校验；
- 同层冲突检测；
- deny、strengthen、allow 覆盖策略；
- mandatory 不可关闭；
- 解析来源链；
- 规范化 JSON 与 SHA-256 快照；
- 审批平台示例；
- CLI、单元测试和 CI。

## 当前边界

- 仅支持 JSON 文件输入；
- 仅消费 PUBLISHED 规则；
- strengthen 的领域语义尚未由类型专用校验器验证；
- 没有数据库、HTTP 服务、UI、认证、调度和 k6 执行；
- 快照只输出到 stdout 或本地文件。

## 下一安全切片

`M1-A — Knowledge Schema and Registry Boundary`

只允许：

- 版本化 JSON Schema；
- 知识对象 ID 和版本规则；
- Registry 端口接口；
- 内存实现与契约测试；
- 发布状态转换的纯领域模型。

暂不允许：

- 生产数据库；
- 登录和权限系统；
- 管理后台；
- AI 自动发布；
- k6 Worker 或生产执行。
