/* eslint-disable no-template-curly-in-string -- 静态核对 GitHub Actions 信任边界。 */

/** 自动记录是独立的已审批写入流程；不能扩展成候选代码执行或发布入口。 */
export function checkReleaseIntentAdmission(workflow, policy, add, expression) {
  const job = workflow?.jobs?.generate ?? {}
  add('自动 changeset 只接受约定的可信事件', {
    pull_request_target: {
      types: ['opened', 'synchronize', 'reopened', 'ready_for_review', 'edited', 'labeled', 'unlabeled', 'closed'],
      branches: ['main', 'alpha', 'beta', 'rc', 'next'],
    },
  }, workflow?.on)
  add('自动 changeset 只有一个受控任务', ['generate'], Object.keys(workflow?.jobs ?? {}))
  add('自动 changeset 审批 Environment', policy.environment, job.environment)
  add('自动 changeset 关闭事件不占用 runner', expression('github.event.action != \'closed\' && !github.event.pull_request.draft'), expression(job.if))
  add('自动 changeset 工作流默认只读', { contents: 'read' }, workflow?.permissions)
  add('自动 changeset 只授予记录写入权限', { 'contents': 'write', 'pull-requests': 'write' }, job.permissions)
  add('自动 changeset 逐 PR 取消旧任务', {
    'group': 'release-intent-${{ github.event.pull_request.number }}',
    'cancel-in-progress': true,
  }, workflow?.concurrency)
  add('自动 changeset 不调用候选 reusable workflow', undefined, job.uses)
  add('自动 changeset 环境不接收候选输入', { LEFTHOOK: '0' }, job.env)
  const steps = job.steps ?? []
  add('自动 changeset 固定执行入口', [
    'actions/checkout',
    'actions/setup-node',
    'pnpm/action-setup',
    'pnpm install --frozen-lockfile --ignore-scripts',
    'node --import tsx .github/auto-changeset/index.mjs',
  ], steps.map(step => step.uses?.split('@')[0] ?? step.run))
  add('自动 changeset actions 固定提交', true, steps.filter(step => step.uses).every(step => /@[a-f\d]{40}$/u.test(step.uses)))
  add('自动 changeset 只 checkout 可信默认分支', {
    'ref': '${{ github.event.repository.default_branch }}',
    'persist-credentials': false,
  }, steps[0]?.with)
  add('自动 changeset 令牌只交给受控脚本', [undefined, undefined, undefined, undefined, { GITHUB_TOKEN: '${{ github.token }}' }], steps.map(step => step.env))
  add('自动 changeset 不注入额外 shell 或条件', true, steps.every(step => step.shell === undefined && step.if === undefined))
}
