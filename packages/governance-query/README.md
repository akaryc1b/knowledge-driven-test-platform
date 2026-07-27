# @kdtp/governance-query

M1-E 的只读治理查询应用边界。

能力：

- 显式请求身份上下文 Port；
- 项目知识列表与详情 DTO；
- 审核时间线 DTO；
- 快照列表与详情 DTO；
- 项目级读取隔离；
- 受控过滤、排序和游标分页；
- 运输无关 Handler；
- 稳定成功与错误响应 envelope。

该包不启动网络端口，不依赖 Express 或 Fastify，不提供任何写入操作。
