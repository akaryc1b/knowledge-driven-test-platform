# M1-I — Read-Only Service Composition and Operational Controls

## 目标

把 M1-B 至 M1-H 的持久化、治理、成员授权、查询、HTTP 和 OIDC 组件组合成一个可启动、可探测、可关闭但仍然严格只读的服务应用。

## 应用组合根

新增：

```text
apps/read-only-governance-service/
```

组合关系：

```text
PostgreSQL Pool
  ├── Registry Adapter
  ├── Governance Evidence Stores
  ├── Project Membership Authorization
  └── readiness check

Remote JWKS Provider
  ├── OIDC Authentication Adapter
  └── readiness check

OIDC Authentication
  → authenticated query identity
  → membership authorization
  → read-only query handlers
  → read-only HTTP transport
```

应用层只负责依赖创建、生命周期和运维控制，不复制 Registry、治理、授权、查询或认证规则。

## 启动顺序

服务必须按固定顺序启动：

1. 解析并验证环境配置；
2. 创建 PostgreSQL Pool；
3. 依次执行 Registry、Governance 和 Project Access migrations；
4. 创建并预热 JWKS Provider；
5. 组装 OIDC、Membership、Query 和 HTTP 组件；
6. 创建运维探针和连接跟踪；
7. 开始监听；
8. 立即执行完整 readiness；
9. readiness 通过后进入可服务状态。

任一步失败都不允许留下开放端口。监听后首次 readiness 失败时，服务必须主动关闭 Server 和 Pool。

## 配置边界

配置只从调用方传入的环境对象解析。关键必填项：

- `KDTP_DATABASE_URL`；
- `KDTP_OIDC_ISSUER`；
- `KDTP_OIDC_JWKS_URI`；
- `KDTP_OIDC_AUDIENCE`；
- `KDTP_OIDC_SUBJECT_MAPPINGS_JSON`。

端口、超时、Pool 大小、限流和关闭窗口均有明确上下限。公开配置视图不得包含数据库 URL、Subject 映射或其他敏感值。

## 运维探针

新增未认证端点：

```text
GET /live
GET /ready
```

`/live`：

- 仅表示进程和事件循环仍能响应；
- 不访问 PostgreSQL、JWKS 或项目数据；
- 服务关闭阶段返回 `stopping`，HTTP 状态仍为 200。

`/ready`：

- 检查 PostgreSQL `SELECT 1`；
- 检查 JWKS 缓存，必要时执行受控刷新；
- 任一依赖失败或超时返回 503；
- 只返回依赖名称和 `ok` / `failed`，不返回异常、URL、连接串或堆栈。

探针只接受 GET，不接受 Query String 或 Request Body。

## 运行事件

新增 `RuntimeEventSinkPort` 与 JSON Lines 实现。事件包括：

- `SERVICE_STARTING`；
- `MIGRATIONS_APPLIED`；
- `JWKS_WARMED`；
- `SERVICE_LISTENING`；
- `SERVICE_READY` / `SERVICE_NOT_READY`；
- `SERVICE_STOPPING` / `SERVICE_STOPPED`；
- `SERVICE_FAILED`；
- `AUTHENTICATION_EVENT`。

运行事件 Details 只允许有限标量值，并拒绝 Token、Credential、Password、Secret、数据库 URL 和连接串等敏感字段。OIDC issuer 在通用运行事件中只记录 SHA-256 指纹。

## 优雅关闭

收到 `SIGTERM` 或 `SIGINT` 后：

1. readiness 立即切换为不就绪；
2. 停止接受新连接；
3. 关闭空闲 Keep-Alive 连接；
4. 在配置窗口内等待活动请求完成；
5. 超时后销毁剩余 Socket；
6. 关闭 PostgreSQL Pool；
7. 记录脱敏停止事件。

关闭操作必须幂等。

## 容器基线

新增应用 Dockerfile：

- Node.js 22 Alpine；
- 固定安装 `pg@8.22.0`；
- 以 `node` 非 Root 用户运行；
- 默认暴露 8080；
- 使用 `/live` 作为容器 Healthcheck；
- 不在镜像中写入 Token、数据库连接或 IdP Secret。

## 验收标准

- 配置缺失或非法时启动失败；
- 三组 migration 顺序稳定；
- JWKS 在监听前完成预热；
- `/live` 与 `/ready` 无需认证且不泄漏业务数据；
- readiness 失败返回 503；
- 首次 readiness 失败会关闭已监听服务；
- 运行事件无 Credential 或连接串；
- 优雅关闭幂等并最终关闭 Pool；
- Dockerfile 明确 `USER node`；
- 完整 Node、HTTP、OIDC 和 PostgreSQL 回归通过。

## 明确不包含

- 任何写入 HTTP 路由；
- 登录页面、Cookie、Session 或 Refresh Token；
- IdP、Subject Mapping 或成员管理 API；
- Kubernetes manifests、自动扩缩容或生产发布；
- k6 Worker、任务队列和生产测试执行。
