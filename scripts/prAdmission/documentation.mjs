/* eslint-disable no-template-curly-in-string -- 冻结输入按 GitHub Actions 表达式字面量核验。 */
const context = '${{ needs.plan.outputs.pr_context }}'
const topology = '${{ fromJSON(needs.plan.outputs.pr_context).verificationTopology }}'
const selected = 'fromJSON(needs.plan.outputs.pr_context).documentationOnly'
const installGuard = 'fromJSON(needs.plan.outputs.pr_context).documentationPaths[0] != null || fromJSON(needs.plan.outputs.pr_context).documentationChecks[0] != null'

function role(step) {
  if (/^actions\/checkout@[a-f\d]{40}$/u.test(step.uses ?? '')) {
    return 'checkout'
  }
  return ({
    './.github/actions/verify-frozen-job-context': 'identity',
    './.github/actions/setup-node-pnpm': 'setup',
    './.github/actions/install-workspace-deps': 'install',
  })[step.uses] ?? (step.run === 'node .github/scripts/lint-frozen-documentation.mjs' ? 'verify' : 'unknown')
}

function readonly(permissions) {
  return permissions === 'read-all' || (permissions && typeof permissions === 'object'
    && permissions.contents === 'read' && Object.values(permissions).every(value => value === 'read' || value === 'none'))
}

/** 独立文档任务仍受同一审批图保护，并完整保留冻结身份与最小生成契约入口。 */
export function checkDocumentationAdmission(workflow, job, add, expression) {
  const steps = Array.isArray(job.steps) ? job.steps : []
  const roles = steps.map(role)
  const step = name => steps[roles.indexOf(name)] ?? {}
  add('documentation 使用冻结的文档选择', expression(selected), expression(job.if))
  add('documentation 保持原生静态任务', undefined, job.uses)
  add('documentation 保持静态任务预算', { runner: 'ubuntu-latest', minutes: 15 }, { runner: job['runs-on'], minutes: job['timeout-minutes'] })
  add('documentation 仅使用只读权限', true, Boolean(readonly(job.permissions ?? workflow.permissions)))
  add('documentation 不放过验证失败', false, job['continue-on-error'] === true || steps.some(item => item['continue-on-error'] === true))
  add('documentation 保持验证工作目录', false, Boolean(job.defaults || steps.some(item => item['working-directory'])))
  add('documentation 验证步骤及顺序', ['checkout', 'identity', 'setup', 'install', 'verify'], roles)
  add('documentation 使用冻结的 merge checkout', {
    'ref': '${{ fromJSON(needs.plan.outputs.pr_context).checkoutSha }}',
    'persist-credentials': false,
  }, step('checkout').with)
  add('documentation 校验冻结身份及拓扑', { context, 'profile': 'documentation', 'verification-topology': topology }, step('identity').with)
  add('documentation 安装固定工具链且只安装一次', { 'node-version': '24', 'install-dependencies': 'false' }, step('setup').with)
  add('documentation 冻结安装不执行生命周期', { 'ignore-scripts': 'true' }, step('install').with)
  for (const name of ['checkout', 'identity', 'verify']) {
    add(`documentation ${name} 不跳过必需验证`, undefined, step(name).if)
  }
  for (const name of ['setup', 'install']) {
    add(`documentation ${name} 覆盖删除生成目标`, expression(installGuard), expression(step(name).if))
  }
  add('documentation 仅传入冻结的文档和生成契约', {
    PR_DOCUMENTATION_PATHS: '${{ toJSON(fromJSON(needs.plan.outputs.pr_context).documentationPaths) }}',
    PR_DOCUMENTATION_CHECKS: '${{ toJSON(fromJSON(needs.plan.outputs.pr_context).documentationChecks) }}',
  }, step('verify').env)
  add('documentation 使用冻结的执行拓扑', { WEAPP_VITE_VERIFICATION_TOPOLOGY: topology }, job.env)
}
