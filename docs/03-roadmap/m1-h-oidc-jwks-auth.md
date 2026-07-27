# M1-H — OIDC/JWKS Read Authentication Adapter

## 目标

为 M1-G 的只读 HTTP Authentication Port 提供可验证 JWT Bearer 的 OIDC/JWKS 适配器，同时保持项目授权继续由 M1-F 成员关系决定。

## 配置边界

应用必须显式提供：

- `issuer`；
- 一个或多个 `audience`；
- `jwksUri`；
- subject mapper；
- 可选 clock skew、maximum token age、JWKS cache 和超时参数。

认证路径不执行 OIDC Discovery，避免隐藏网络调用、issuer 混淆和启动后配置漂移。

## JWT 验证顺序

```text
Compact JWT 格式
    ↓
Header algorithm/kid allow-list
    ↓
拒绝 token-controlled key URL 和 crit
    ↓
iss/aud/sub/exp/nbf/iat
    ↓
获取与 kid 匹配的 JWKS key
    ↓
RSA 2048-bit 与 key metadata 校验
    ↓
RS256 signature verification
    ↓
subject mapper
    ↓
平台 actor
```

任一步失败都不会进入项目授权或查询层。

## Algorithm 策略

首版仅支持 `RS256`：

- 配置 allow-list 只能包含实现明确支持的算法；
- `none`、HMAC、token header 中的 `jku`、`x5u`、`jwk`、`x5c` 和 `crit` 全部拒绝；
- JWKS key 必须为 RSA public key；
- modulus 不得低于 2048 bits；
- `use` 和 `key_ops` 若存在，必须允许验签。

## Claims 策略

- `iss` 必须与显式 issuer 精确相等；
- `aud` 必须与允许 audience 至少匹配一个；
- `sub` 必须存在；
- `exp` 和 `iat` 必须存在；
- `nbf` 存在时必须生效；
- clock skew 默认 60 秒，最大 300 秒；
- 可配置 maximum token age；
- `exp` 必须晚于 `iat` 和 `nbf`。

## JWKS 策略

- 生产 URI 强制 HTTPS；
- 请求超时默认 3 秒；
- 流式读取默认限制 128 KiB；
- key 数默认最多 32；
- Cache-Control `max-age` 可被采用，但受本地最大 TTL 限制；
- 同一时刻只允许一个 refresh Promise；
- cache miss 的未知 `kid` 在最小刷新间隔后触发一次强制刷新；
- 刷新后仍找不到 key 时返回通用无效 Token；
- JWKS 网络或格式故障返回认证不可用，不回退到未验证 claims。

## Subject Mapping

`SubjectMapperPort` 接收已验证的 issuer、subject 和 claims，返回平台 actor 与受控 attributes。静态 mapper 只用于测试和示例，后续可接公司目录或账号绑定表。

subject 未映射或映射停用时默认拒绝。

## 可观测事件

事件类型：

- `AUTHENTICATION_SUCCEEDED`；
- `AUTHENTICATION_FAILED`；
- `JWKS_REFRESHED`。

事件可以包含 request ID、issuer、kid、原因码、key 数和 subject fingerprint，但不得包含：

- 原始 Bearer Token；
- JWT signature；
- 完整 claims；
- JWKS modulus 或公钥正文。

事件 Sink 失败不改变认证结果，避免观测系统故障造成认证级联中断。

## 错误语义

- 无效 Token、签名、claims、kid 或 subject mapping：通用 401；
- JWKS 网络、超时或无效文档：503，经 M1-G 统一 5xx 脱敏；
- 适配器配置错误或无效 mapper 结果：500，经 M1-G 统一脱敏。

## 明确不包含

- OIDC Discovery；
- ES256、PS256 或对称算法；
- Authorization Code Flow；
- 登录页面、Cookie、Session 或 Refresh Token；
- Token introspection 和 revocation；
- IdP 配置管理；
- subject mapping 管理 API；
- 写入 HTTP API。

## 验收标准

- 有效 RS256 JWT 可映射平台 actor；
- issuer、audience、时间声明和签名错误均被拒绝；
- 弱 RSA key 被拒绝；
- JWKS cache hit 不重复请求；
- 并发请求共享同一刷新；
- key rotation 可通过未知 kid 刷新生效；
- JWKS 超时、过大或无效响应 fail closed；
- 事件不包含 Token、claims 或 key material；
- 真实临时 JWKS Server 测试通过；
- M1-A 至 M1-G 全部回归继续通过。
