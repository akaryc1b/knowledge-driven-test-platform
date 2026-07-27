# @kdtp/governance-auth-oidc

M1-H 的 OIDC/JWKS 只读认证适配器。

能力：

- RS256 JWT Bearer 验证；
- issuer、audience、`exp`、`nbf`、`iat` 与 clock skew；
- HTTPS JWKS、bounded cache、刷新去重和 key rotation；
- RSA 2048-bit 最小密钥要求；
- subject 到平台 actor 的映射 Port；
- 成功、失败和 JWKS 刷新事件；
- Token、claims 和 key material 脱敏。

该包不执行 OIDC Discovery，不提供登录流程、Session、Refresh Token、Token introspection 或写入 API。
