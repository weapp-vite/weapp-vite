## 5. Commit and Changeset Rules

- Use Conventional Commits, e.g.:
  - `feat(weapp-vite): add css preprocess support`
- Before every commit, run the smallest lint checks that match the staged changes, not just build/test checks.
- Never use Prettier in this repository, including ad-hoc formatting, editor save hooks, scripts, or pre-commit steps; use the smallest applicable ESLint-based fix command instead.
- `lint-staged` and `.husky/pre-commit` are mandatory enforcement layers, not optional convenience tooling; when adjusting lint scope, keep both aligned so staged files fail locally before CI, including in `git worktree` directories.
- Run needed local checks before review (`build`, `test`, `lint` scope depends on touched area).
- Before pushing or opening a PR, run the smallest package- or path-scoped `lint` / `test` / `build` checks that cover the changed area; do not rely on `pre-commit` as a substitute for review-time verification.
- Add a changeset only for user-visible or behavior-impacting changes, such as `feat`, functional `fix`, or other changes that alter runtime/build behavior, public APIs, generated outputs, or template/app observable results.
- Do not add a changeset for changes that are purely tests, docs, comments, refactors, internal tooling, or other non-user-visible maintenance work, unless they also include a user-visible or behavior-impacting change.
- For source code bug fixes that change real behavior (including GitHub issue fixes with unit/e2e updates), adding a changeset is mandatory; do not skip it.
- If release includes `weapp-vite`, `wevu`, or anything under `templates/`, also include a `create-weapp-vite` bump changeset.
- `.changeset/*.md` summary paragraph must be in Chinese.
- Default delivery action is commit-only: after checks pass, commit the changes directly, and do not push unless the user explicitly requests push.
- Exception for GitHub bug-fix workflow: when the task is a GitHub issue fix, complete the work through a PR to the mainline branch and treat post-merge worktree cleanup as part of the task.
