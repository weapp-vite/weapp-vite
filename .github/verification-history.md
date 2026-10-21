# CI 分片耗时历史

`verification-history.mjs` 从默认分支 `ci-e2e.yml` 的可信成功运行收集历史，限定最近 30 天，最多保留 10 轮。运行和 artifact 清单都分页读取；某轮没有目标 OS/Node 的完整 aggregate 时继续查找，不在首个匹配后结束。下游 `collectDurationHistory` 仍逐报告核对实际 profile、源码、完整任务范围、成功状态和报告时间，再按任务取最近样本的中位数。历史不可用时使用原有确定性权重，不减少验证范围。

只接受 `push`、`schedule` 或默认分支 `workflow_dispatch`，拒绝 PR、其它分支及其它仓库。API 的 `run_attempt` 本身不证明所有作业重新执行；每个实际执行作业都须同时属于本轮 run/attempt，且开始和结束时间完整落在当前 attempt 区间。复用先前成功作业的部分重跑不能贡献历史。

同名 artifact 可能同时存在于多个 attempt。先核验全量 artifact 的 run、repository、head repository、branch、SHA 与创建时间，再从当前 attempt 时间窗选择唯一、未过期的名称；旧归档不能替代缺失的新归档。下载使用核验后的精确 artifact ID，以二进制文件接收 ZIP，不使用按名称取首项的 `gh run download --name`。

共享 `verification-artifacts.mjs` 在解压前核验 REST 大小和 SHA-256，完整检查路径、平台别名、祖先文件冲突、Unix 文件类型及解压预算；文件内容同时核对长度和 CRC。历史 ZIP 及失败轮次的目录会清理，只保留成功报告与 API 派生 receipt。请求认证通过环境传入，错误输出不回显请求参数或令牌。

本地检查：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/verification-history.test.mjs scripts/verificationBenchmark/ci/archive.test.mjs
pnpm exec eslint .github/scripts/verification-artifacts.mjs .github/scripts/verification-history.mjs scripts/verification-history.test.mjs scripts/verificationBenchmark/ci/archive.test.mjs .github/verification-history.md
```
