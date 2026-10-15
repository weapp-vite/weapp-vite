## 5. Commit and Changeset Rules

- Use Conventional Commits, e.g.:
  - `feat(weapp-vite): add css preprocess support`
- Before every commit, run the smallest lint checks that match the staged changes, not just build/test checks.
- Never use Prettier in this repository, including ad-hoc formatting, editor save hooks, scripts, or pre-commit steps; use the smallest applicable ESLint-based fix command instead.
- `lint-staged` and `.husky/pre-commit` are mandatory enforcement layers, not optional convenience tooling; when adjusting lint scope, keep both aligned so staged files fail locally before CI, including in `git worktree` directories.
- Run needed local checks before review (`build`, `test`, `lint` scope depends on touched area).
- Before pushing or opening a PR, run the smallest package- or path-scoped `lint` / `test` / `build` checks that cover the changed area; do not rely on `pre-commit` as a substitute for review-time verification.
- PR 创建、更新提交和重新打开时，由 `PR CI` 原生 workflow 创建检查；所有验证必须等待 `pr-ci-approval` Environment 的人工批准。维护者从检查详情进入 `Review deployments` 批准一次后，启动本轮所有适用检查；每次新提交重新审批，旧运行取消，不得沿用旧批准改测新提交。不同 PR 可以同时验证。
- 普通 PR 验证直接使用原生 job checks 展示矩阵进度和结果，不再依赖从 main 调度后的汇总状态回写。共用验证主体通过 `workflow_call` 消费统一冻结的 PR head/base/merge 上下文；候选代码只获得只读权限，评论等写入由可信主线完成报告处理。
- 现有 `workflow_dispatch` 与 `pr-number` 参数保留为独立手动诊断入口；留空维持原有独立或全量模式。完整性能验收通过 `Nightly Performance` 显式选择 PR，不随普通审批自动采样；主线定时检查及合并后的发布、部署保留。
- Add a changeset only for user-visible or behavior-impacting changes, such as `feat`, functional `fix`, or other changes that alter runtime/build behavior, public APIs, generated outputs, or template/app observable results.
- Do not add a changeset for changes that are purely tests, docs, comments, refactors, internal tooling, or other non-user-visible maintenance work, unless they also include a user-visible or behavior-impacting change.
- For source code bug fixes that change real behavior (including GitHub issue fixes with unit/e2e updates), adding a changeset is mandatory; do not skip it.
- If release includes `weapp-vite`, `wevu`, or anything under `templates/`, also include a `create-weapp-vite` bump changeset.
- `.changeset/*.md` summary paragraph must be in Chinese.
- Default delivery action is commit-only: after checks pass, commit the changes directly, and do not push unless the user explicitly requests push.
- Exception for GitHub bug-fix workflow: when the task is a GitHub issue fix, complete the work through a PR to the mainline branch and treat post-merge worktree cleanup as part of the task.
