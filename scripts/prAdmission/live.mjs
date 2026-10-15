// eslint-disable-next-line e18e/ban-dependencies -- 沿用仓库的跨平台 CLI 启动、超时与错误传播约定。
import { execa } from 'execa'
import { check, incomplete } from './report.mjs'

/** 使用参数数组调用原生 gh 可执行文件，兼容三系统，禁止 shell 拼接与交互等待。 */
export async function runGh(args, cwd) {
  try {
    const { stdout } = await execa('gh', args, { cwd, shell: false, timeout: 30_000, env: { GH_PROMPT_DISABLED: '1' } })
    return stdout
  }
  catch (error) {
    const reason = error.code === 'ENOENT'
      ? '未找到 gh'
      : error.timedOut
        ? '查询超时'
        : /\bHTTP [1-5]\d{2}\b/u.exec(error.stderr ?? '')?.[0] ?? '查询失败'
    throw new Error(`GitHub CLI ${reason}；请检查 gh 安装、登录、网络和仓库管理配置的读取权限`)
  }
}

function environmentChecks(policy, environment) {
  if (!environment || typeof environment.name !== 'string' || typeof environment.can_admins_bypass !== 'boolean'
    || !Array.isArray(environment.protection_rules) || !Object.hasOwn(environment, 'deployment_branch_policy')) {
    throw new TypeError('Environment API 响应缺少配置字段，无法完成核验')
  }
  const rules = environment.protection_rules
  const reviewerRules = rules.filter(rule => rule.type === 'required_reviewers')
  const timerRules = rules.filter(rule => rule.type === 'wait_timer')
  const reviewers = reviewerRules.flatMap(rule => rule.reviewers ?? [])
  if (reviewerRules.some(rule => !Array.isArray(rule.reviewers) || typeof rule.prevent_self_review !== 'boolean')
    || reviewers.some(row => typeof row.reviewer?.login !== 'string' || typeof row.type !== 'string')
    || timerRules.some(rule => !Number.isSafeInteger(rule.wait_timer) || rule.wait_timer < 0)) {
    throw new TypeError('Environment API 返回了无效的审批或等待规则，无法完成核验')
  }
  return [
    check('线上审批 Environment', policy.environment, environment.name),
    check('指定审批保护数量', 1, reviewerRules.length),
    check('指定审批人', policy.reviewers.map(login => `User/${login}`).sort(), reviewers.map(row => `${row.type}/${row.reviewer.login}`).sort()),
    check('禁止自行批准', policy.preventSelfReview, reviewerRules[0]?.prevent_self_review),
    check('管理员可绕过', policy.canAdminsBypass, environment.can_admins_bypass),
    check('等待计时器（分钟）', [policy.waitTimer], timerRules.length === 0 ? [0] : timerRules.map(rule => rule.wait_timer)),
    check('Environment 分支限制', policy.deploymentBranchPolicy, environment.deployment_branch_policy),
  ]
}

/** 线上只发 GET；各接口独立保留失败，权限或网络错误不能冒充配置通过。 */
export async function checkLiveAdmission(policy, { repository, root, gh = runGh }) {
  const results = []
  try {
    repository ??= (await gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], root)).trim()
    if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
      throw new TypeError('仓库必须为 owner/repo 格式')
    }
  }
  catch (error) {
    return [incomplete('识别线上仓库', error.message)]
  }
  const endpoints = [
    [`repos/${repository}/environments/${encodeURIComponent(policy.environment)}`, '线上审批保护', value => environmentChecks(policy, value)],
    [`repos/${repository}/actions/permissions/fork-pr-contributor-approval`, '外部贡献者审核', (value) => {
      if (typeof value?.approval_policy !== 'string') {
        throw new TypeError('fork 审核 API 响应缺少 approval_policy，无法完成核验')
      }
      return [check('fork 审核策略', policy.forkApprovalPolicy, value.approval_policy)]
    }],
  ]
  for (const [endpoint, name, inspect] of endpoints) {
    try {
      const output = await gh(['api', '--method', 'GET', endpoint], root)
      results.push(...inspect(JSON.parse(output)))
    }
    catch (error) {
      results.push(incomplete(`${repository}: ${name}`, error instanceof SyntaxError ? 'GitHub API 响应不是有效 JSON' : error.message))
    }
  }
  return results
}
