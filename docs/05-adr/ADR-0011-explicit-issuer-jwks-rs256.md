# ADR-0011：显式 issuer/JWKS 与首版 RS256

- 状态：Accepted
- 日期：2026-07-27

## 背景

M1-G 已建立只读 HTTP Authentication Port，但内存 Token 适配器不能验证真实外部身份。直接在每次请求中执行 OIDC Discovery 会引入隐藏网络调用、配置漂移和 issuer 混淆；一次性支持大量 JWT 算法也会扩大首个生产认证边界的攻击面。

## 决策

1. 应用组合根显式配置 issuer、audience 和 jwksUri；
2. 认证请求路径不执行 OIDC Discovery；
3. 首版只支持 RS256；
4. Token header 不得控制签名 key 来源；
5. JWKS 生产地址必须使用 HTTPS；
6. JWKS 响应使用超时、流式大小限制、key 数限制和 bounded cache；
7. 未知 kid 只触发受控刷新，且并发刷新去重；
8. RSA key 不得低于 2048 bits；
9. 已验证 subject 通过独立 Port 映射平台 actor；
10. 认证事件只记录受控元数据和 subject fingerprint；
11. 无效 Token 返回通用 401，JWKS 基础设施故障 fail closed。

## 结果

优点：

- 认证依赖和信任根显式；
- 请求路径确定且可测试；
- 降低算法混淆和远程 key 注入风险；
- key rotation、缓存和并发行为可控；
- subject mapping 可独立接入公司目录；
- Token 和 claims 不进入业务查询与日志事件。

代价：

- IdP 或 JWKS 地址变更需要显式配置发布；
- 首版不能使用 ES256 或 PS256；
- 不包含 Discovery、introspection 和 revocation；
- 事件 Sink 当前为 best-effort，需要后续运行时治理补充持久化策略。
