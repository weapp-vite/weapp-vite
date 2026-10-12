# Release PR 重复 CI 诊断与修复

PR #1115 的 50 项红色检查均为 CANCELLED，没有 FAILURE。12 个 workflow 在批准前各已有
两个独立 run 和 check suite；批准后，共享 concurrency group 的运行互相抢占，取消了
CI 的 2 项、CI E2E 的 13 项和 Vite Host Consumer 的 35 项。审批使已有运行开始执行，
不能据此认定审批生成了重复运行。

发布客户端在推送 Release 分支后，无条件 PATCH 现有 PR，并重新提交已被查询条件限定的
base。该冗余请求是第二次同步触发的候选来源；REST run 元数据没有 webhook action，
尚不足以独立证明云端两批运行的事件来源。

修复生产者的更新契约：现有 PR 只 PATCH 标题和正文，内容相同时不发请求；null 正文与
空正文等价。创建 PR 仍保留 head/base，真实 API 错误仍失败。保留发布说明分类补丁、
全部质量门禁、凭据策略，以及新提交取消旧提交的 concurrency 行为。

通过正式 repoctl 导出的 GitHubClient 注入 fetch，验证查询、最小更新、幂等更新、创建和
错误传播，加入 test:release。推送修复后观察实际 Release PR 的新 head：每个 workflow
应只有一个原始 run，批准后无同 head 互相取消；如仍重复，继续追查事件来源，不以重跑
掩盖取消记录或宣称修复完成。
