## 5. Commits, Pull Requests, and Releases

- Use Conventional Commits, for example `feat(weapp-vite): add css preprocess support`. Before each commit run the smallest staged lint plus applicable tests/builds. Never use Prettier. `lefthook.yml`, repoctl's native hook installer, staged typecheck/commitlint, ESLint, and Stylelint are the enforcement path. Lefthook may retain successful fixes in the index after a later failure, so inspect staged changes before retrying.
- Before review or push, run the smallest path/package-scoped lint, test, build, and generated-contract checks covering the diff. A pre-commit hook is not review evidence. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for quick/review/full selection and repository-native push semantics.
- Default delivery is commit-only. Push only when requested. GitHub issue fixes are delivered through a PR to main, with post-merge worktree cleanup.
- PR titles, bodies, and follow-up reviews default to Chinese. GitHub-facing text must use repo-relative paths and reproducible commands. Never include local absolute paths, usernames, workspace/temp paths, machine-specific environment values, tokens, email addresses, or credentials.

### 5.1 Changesets

- Add a Chinese-summary changeset for user-visible/runtime/build behavior, public APIs/types, generated outputs, or template/app results. A source bug fix that changes real behavior requires one even when tests are the main diff.
- Do not add a changeset for docs, tests, comments, behavior-neutral refactors, or internal tooling alone. When a release changes `weapp-vite`, `wevu`, or `templates/*`, include the required `create-weapp-vite` bump.
- Follow `$release-and-changeset-best-practices` for intent classification, issue delivery, version preparation, and recovery.

### 5.2 PR CI and Approval

- Native `PR CI` checks are created for each PR open/reopen and new revision. Every revision needs its own `pr-ci-approval` Environment approval. Cancel old runs and never reuse an approval or result for a changed head. An AI may approve only the selected PRs and later revisions covered by explicit maintainer authorization, after re-verifying PR, run, and head. Authorization never transfers to another PR.
- Fork PRs keep the `all_external_contributors` review policy and require GitHub's review plus approval by an authorized maintainer/account. The Environment allows self-approval and does not allow administrator bypass. Closing a PR cancels its concurrency group through trusted default-branch `pull_request_target` logic without executing candidate code. Reopening requires fresh approval.
- Approval volume may focus runner capacity but must not introduce a global lock or fixed active-PR cap. Unrelated approved PRs may validate concurrently.
- Candidate code receives read-only permissions. Native job checks show progress. Trusted main-side reporting owns writes. Automatic comments run only for overall success. For a failed completed run, use the [default-branch completed-run report](docs/manual-pr-actions.md#原生运行的完成报告) after verifying its frozen revision and approval.
- Finish only after every applicable job/check, post-aggregation, status, and workflow reaches its expected terminal state. Match skips to their declared conditions. Missing, canceled, pending, or newly skipped checks do not pass. Bind evidence to PR, head/base, actual checkout/merge SHA, run ID, and attempt.

### 5.3 Release Safety

- `Automatic Release Intent` freezes PR data and policy from trusted main. Plan and apply need separate approvals. Preserve handwritten changesets and fork read-only behavior. A generated release commit is a new revision and must pass fresh PR approval and CI.
- Official version PRs may be repaired and pushed within the authorized task, but the user must perform the final merge that triggers production release. Do not auto-merge, join a merge queue, or publish directly.
- Before modifying or recovering a release, reconcile `pnpm change status`, target versions, frozen source commit and notes, `.changeset/ledger.yaml`, progress/checkpoint artifacts, and exact registry versions. A 404 or missing upload does not authorize changing frozen preparation metadata. Document late fixes already in the frozen source separately from frozen release notes. Reprepare or defer fixes outside that source.
- Preserve the first failure and registry state. Resume partial publication from the recorded source/checkpoint and upload only missing packages. Never overwrite a published version, upload different source under the same version, edit the ledger to fake consumption, or use an unrelated bump to hide failure.
- Release completion requires the current `plan → verify → prepare → upload → confirm → finalize` chain and verification of exact registry version, dist-tag, tarball/integrity, and internal dependency visibility. Command success or green PR CI alone is insufficient. Post-merge automatic Release workflows are recorded with their observed status but do not block later PR work.
