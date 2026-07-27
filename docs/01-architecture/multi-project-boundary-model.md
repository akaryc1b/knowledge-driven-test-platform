# 多项目边界模型

## 五层作用域

```text
GLOBAL < DOMAIN < PROJECT < ENVIRONMENT < RELEASE
```

### GLOBAL

公司级最低基线，例如日志脱敏、审计、错误响应和质量门禁。只存放跨项目共同约束。

### DOMAIN

可组合的领域能力包，例如认证、RBAC、多租户、审批、库存、订单和 WebSocket。

### PROJECT

项目独有业务规则、状态机、权限矩阵、接口契约、数据约束和性能目标。

### ENVIRONMENT

允许按环境变化的参数，例如目标域名、数据规模、测试账号、并发和非关键 SLO。

### RELEASE

某个发布版本的临时特性边界和回归范围。发布层不能绕过公司强制规则。

## 项目边界包

```text
projects/{projectId}/
├── project-manifest.json
├── rules/
├── contracts/
├── workflows/
├── permissions/
├── performance/
├── dependencies/
└── environments/
```

## 复用原则

平台复用的是能力模板和执行器，不直接复用项目业务结论。例如分页测试模板可以共享，但 `maxPageSize`、错误码和性能目标必须来自项目边界。

## 项目隔离

- 项目知识默认只对项目成员可见；
- 项目只能引用已发布的公司基线和领域包；
- 跨项目共享必须提升为领域能力包或共享测试资产；
- 项目 A 不能直接依赖项目 B 的内部规则路径；
- 证据与快照必须携带项目命名空间。
