## 5. Commit and Changeset Rules

- Use Conventional Commits, e.g.:
  - `feat(weapp-vite): add css preprocess support`
- Before every commit, run the smallest lint checks that match the staged changes, not just build/test checks.
- Never use Prettier in this repository, including ad-hoc formatting, editor save hooks, scripts, or pre-commit steps; use the smallest applicable ESLint-based fix command instead.
- `lefthook.yml` is the mandatory enforcement layer; use repoctl's native hook installer, staged typecheck and commitlint entrypoints, while keeping repository staged semantics and ESLint/Stylelint aligned, including in linked `git worktree` directories. Lefthook owns partial-staging hide/restore and stages successful fixes; a later failure can retain those fixes in the index, so review before retrying.
- Run needed local checks before review (`build`, `test`, `lint` scope depends on touched area).
- Before pushing or opening a PR, run the smallest package- or path-scoped `lint` / `test` / `build` checks that cover the changed area; do not rely on `pre-commit` as a substitute for review-time verification.
- PR 创建、更新提交和重新打开时，由 `PR CI` 原生 workflow 创建检查；所有验证必须等待 `pr-ci-approval` Environment 批准。维护者可从检查详情进入 `Review deployments` 批准，也可明确授权 AI 通过 GitHub 原生界面或 API 代为批准指定 PR。批准后启动本轮所有适用检查；每次新提交重新审批，旧运行取消，不得沿用旧批准改测新提交。不同 PR 可以同时验证。
- 通过批准数量将有限 runner 资源集中到维护者关注的少数 PR；不增加全局串行锁或固定活跃 PR 上限。AI 可以按用户或维护者的明确授权批准所选 PR；授权覆盖同一任务中这些 PR 的后续修复提交时，无须重复请求用户确认，但每轮仍须核验 PR、运行编号和当前 head revision，并独立提交 Environment 批准。保留可追溯的授权与审批记录，禁止为了“全部跑绿”批量批准无人关注的 PR，也不得批量调度手动诊断绕过准入。
- fork PR 的仓库审核策略固定为 `all_external_contributors`，配置后回读核验；所有外部贡献者均需 GitHub 原生审核，再由指定维护者或其明确授权的 AI 通过 `pr-ci-approval`，AI 使用的账号仍须具备该 Environment 的审批权限。Environment 允许自行批准、禁止管理员绕过。
- 关闭 PR 仅通过可信默认分支的 `pull_request_target: closed` 取消同一 PR 并发组，全部 job 跳过，不执行候选代码、不占 runner；重新打开后重新审批。常规运行取消后只执行必要清理，不再启动后续验证、报告或 artifact 上传；普通失败继续保留证据，完整 Nightly Performance 的证据策略保持原样。
- 普通 PR 验证直接使用原生 job checks 展示矩阵进度和结果，不再依赖从 main 调度后的汇总状态回写。共用验证主体通过 `workflow_call` 消费统一冻结的 PR head/base/merge 上下文；候选代码只获得只读权限，评论等写入由可信主线完成报告处理。
- 原生 PR 自动评论仅处理整体成功运行；失败、取消、拒绝及审批过期直接查看 Checks，不启动自动报告 runner。需要失败报告时，从默认分支显式运行 `gh workflow run ci-performance-comment.yml --ref main -f run-id=<运行ID>`；报告只接受已完成的原生 PR CI，下载前核验审批与冻结阶段，发布前拒绝过期提交及旧结果覆盖。
- `Automatic Release Intent` 使用 repoctl 原生按需工作流：从默认分支选择 PR，plan 和 apply 分别通过 `pr-ci-approval`，只用固定版本工具和默认分支 JSON 策略读取冻结的 PR 数据；保留手写 changeset，fork 只读。自动提交创建新 revision 后重新审批原生 PR CI，不用额外 App/PAT 或手动诊断调度绕过准入。
- 现有 `workflow_dispatch` 与 `pr-number` 参数保留为独立手动诊断入口；留空维持原有独立或全量模式。完整性能验收通过 `Nightly Performance` 显式选择 PR，不随普通审批自动采样；主线定时检查及合并后的发布、部署保留。
- Add a changeset only for user-visible or behavior-impacting changes, such as `feat`, functional `fix`, or other changes that alter runtime/build behavior, public APIs, generated outputs, or template/app observable results.
- Do not add a changeset for changes that are purely tests, docs, comments, refactors, internal tooling, or other non-user-visible maintenance work, unless they also include a user-visible or behavior-impacting change.
- For source code bug fixes that change real behavior (including GitHub issue fixes with unit/e2e updates), adding a changeset is mandatory; do not skip it.
- If release includes `weapp-vite`, `wevu`, or anything under `templates/`, also include a `create-weapp-vite` bump changeset.
- `.changeset/*.md` summary paragraph must be in Chinese.
- Default delivery action is commit-only: after checks pass, commit the changes directly, and do not push unless the user explicitly requests push.
- Exception for GitHub bug-fix workflow: when the task is a GitHub issue fix, complete the work through a PR to the mainline branch and treat post-merge worktree cleanup as part of the task.

### 5.1 CI 证据与完成判据

- 每轮绑定 PR、head/base、实际 checkout/merge SHA、run ID 和 attempt；以本轮冻结的路径选择及工作流条件确定适用检查，不沿用旧提交的通过数。若用本地 head 的结果解释 CI merge，先核对二者内容是否一致。
- 完成时核对全部适用 jobs/checks、后置聚合、commit statuses 和相关 workflow 的终态；既定 skip 逐项对应条件，缺失、取消、未完成及新增 skip 不算通过。不能只看 required checks、总数或一个汇总绿色图标。
- 复用审批授权前确认其对象及范围；某个 PR 的本轮及后续提交授权不覆盖其他 PR。在授权范围内，每次新提交仍独立核验并批准对应 environment，不绕过准入另开诊断矩阵，也不为内部文档维护新增用户未要求的审批或全量验收。

### 5.2 发布准备与失败恢复

- 修改版本 PR 或恢复发布前，核对 `pnpm change status`、目标版本、准备来源提交、对应 changelog、`.changeset/ledger.yaml`、发布进度/checkpoint 和 registry 精确版本状态。区分待消费 intent、已准备版本、registry 已接受但尚未确认，以及已完成发布；状态未知不能按未发布处理。
- 先读取发布器对来源、版本及说明的冻结约束。尚未上传或 registry 返回 404，不代表已提交的准备元数据可以修改；不得手改账本冒充 intent 已消费，或改写清单/changelog 制造新的准备来源。
- 版本 PR 的迟到修复先核对代码是否已经包含在冻结来源中。已包含的补充维护记录与冻结 release notes 分开保存，注明原 intent 及来源，不冒充发布器已重新消费；未包含的代码按工具支持的重新准备或后续版本流程交付。保留用户可见的说明，不机械地向冻结批次追加 intent，不为通过保护检查删掉说明或放宽断言。
- 失败先保存原始日志及发布进度，再确认是否已上传或被 registry 接受。部分发布按原来源和 checkpoint 恢复，仅重试仍需上传的内容；不得覆盖已发布版本、换源码重传同版本或用无关 bump 掩盖失败。执行恢复命令前核对实际版本的参数与 guard，错误消息中的建议不等于当前状态一定满足前提。
- PR CI 全绿只证明候选验证通过。发布完成须核对本轮 `plan → verify → prepare → upload → confirm → finalize`、目标 registry 的精确版本、预期 dist-tag、tarball 及完整性元数据和内部依赖可见性；保留来源与原始证据，未完成项明确记录，不能把上传命令退出成功代替完整发布确认。
