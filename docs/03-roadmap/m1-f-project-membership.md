# M1-F — Durable Project Membership and Read Authorization

## 目标

将 M1-E 的调用方授权示例升级为可持久化的项目目录和成员关系，使现有治理服务与只读查询服务可以由真实项目角色驱动，并保持默认拒绝。

## 项目模型

项目状态：

```text
ACTIVE → SUSPENDED → ACTIVE
   └──────────────→ ARCHIVED
SUSPENDED ────────→ ARCHIVED
```

ARCHIVED 为终态。非 ACTIVE 项目拒绝全部治理动作。

## 成员模型

成员状态：

```text
ACTIVE → SUSPENDED → ACTIVE
   └──────────────→ REVOKED
SUSPENDED ────────→ REVOKED
```

REVOKED 为终态。成员还包含：

- `validFrom`：成员权限开始生效时间；
- `validUntil`：可选、排他的权限失效时间；
- `revision`：所有修改使用 CAS；
- append-only 审计历史。

## 基础角色

| 角色 | 核心能力 |
|---|---|
| VIEWER | 知识与快照只读 |
| AUTHOR | 创建、编辑、提交知识 |
| REVIEWER | 审核知识、读取审计 |
| PUBLISHER | 发布、废弃、归档知识 |
| AUDITOR | 知识、审计和快照只读 |
| AUTOMATION | 快照读写与自动化只读 |
| PROJECT_ADMIN | 当前全部治理动作 |

项目不能通过请求参数临时扩展角色能力。角色映射由平台确定性策略定义。

## 授权顺序

```text
项目存在且 ACTIVE
    ↓
成员存在且 ACTIVE
    ↓
当前时间位于有效期窗口
    ↓
至少一个角色授予目标治理动作
    ↓
允许
```

任何条件不满足都返回 deny 结果，不抛出“默认允许”。

## PostgreSQL 边界

数据库包含：

- `kdtp_access.projects`；
- `kdtp_access.project_history`；
- `kdtp_access.project_memberships`；
- `kdtp_access.membership_history`；
- 独立 checksum migration 目录。

项目与成员写操作使用行锁和 revision CAS。历史表通过触发器禁止 UPDATE 与 DELETE。

PostgreSQL 授权适配器在同一只读事务中读取项目和成员状态，再调用核心纯授权函数。

## 验收标准

- 未配置项目或成员默认拒绝；
- 暂停或归档项目拒绝；
- 暂停或撤销成员拒绝；
- 未到生效时间或达到失效时间拒绝；
- VIEWER 可以读取但不能编辑；
- PROJECT_ADMIN 可以执行所有现有治理动作；
- 跨项目成员不产生权限；
- 并发成员更新只有一个 revision 写入者成功；
- 内存与 PostgreSQL Adapter 通过相同合同；
- 审计历史不可篡改；
- M1-A 至 M1-E 全部回归通过。

## 明确不包含

- OAuth/OIDC、SAML 或 SCIM；
- 项目邀请和审批流程；
- 自定义角色管理；
- 成员管理 HTTP API 或 UI；
- AI 自动授权；
- 生产测试执行。
