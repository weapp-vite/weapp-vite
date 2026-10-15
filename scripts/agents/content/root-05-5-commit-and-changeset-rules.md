## 5. Commit and Changeset Rules

- Use Conventional Commits, e.g.:
  - `feat(weapp-vite): add css preprocess support`
- Before every commit, run the smallest lint checks that match the staged changes, not just build/test checks.
- Never use Prettier in this repository, including ad-hoc formatting, editor save hooks, scripts, or pre-commit steps; use the smallest applicable ESLint-based fix command instead.
- `lint-staged` and `.husky/pre-commit` are mandatory enforcement layers, not optional convenience tooling; when adjusting lint scope, keep both aligned so staged files fail locally before CI, including in `git worktree` directories.
- Run needed local checks before review (`build`, `test`, `lint` scope depends on touched area).
- Before pushing or opening a PR, run the smallest package- or path-scoped `lint` / `test` / `build` checks that cover the changed area; do not rely on `pre-commit` as a substitute for review-time verification.
- PR Actions 必须显式手动触发；创建 PR、更新提交或转为可评审状态不会自动运行检查。人工在 Actions 的 `Run workflow` 填写 `pr-number`；AI 使用 `gh workflow run <workflow>.yml --ref main -f pr-number=<PR编号>`。按任务需要选择检查，核对运行摘要和 `pr-context` artifact 中固定的 head/base SHA 与当前 PR 一致，再依据结果安排合并。不同 PR 可同时验证；主线定时检查及合并后的发布、部署保留。
- 手动输入 `pr-number` 才启用原 PR 验证范围、矩阵和路径条件；留空保留 workflow 原有的独立或全量验证行为。PR 专属的性能冒烟、运行时体积检查必须填写编号；完整性能验收通过 `Nightly Performance` 显式选择 PR，定时任务只检查主线。
- Add a changeset only for user-visible or behavior-impacting changes, such as `feat`, functional `fix`, or other changes that alter runtime/build behavior, public APIs, generated outputs, or template/app observable results.
- Do not add a changeset for changes that are purely tests, docs, comments, refactors, internal tooling, or other non-user-visible maintenance work, unless they also include a user-visible or behavior-impacting change.
- For source code bug fixes that change real behavior (including GitHub issue fixes with unit/e2e updates), adding a changeset is mandatory; do not skip it.
- If release includes `weapp-vite`, `wevu`, or anything under `templates/`, also include a `create-weapp-vite` bump changeset.
- `.changeset/*.md` summary paragraph must be in Chinese.
- Default delivery action is commit-only: after checks pass, commit the changes directly, and do not push unless the user explicitly requests push.
- Exception for GitHub bug-fix workflow: when the task is a GitHub issue fix, complete the work through a PR to the mainline branch and treat post-merge worktree cleanup as part of the task.
