/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式需要按字面量核验。 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'
import { check } from './report.mjs'

const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value]
const sorted = value => [...value].sort()
function expression(value) {
  return typeof value === 'string'
    ? value.replace(/^\s*\$\{\{|\}\}\s*$/gu, '').replace(/'[^']*'|"[^"]*"|\s+/gu, match => match.trim() ? match : '')
    : value
}

// 只核对已约定的保护表达式，不执行仓库 YAML 中的代码。
const reportGuards = {
  'comment': `contains(fromJSON('["CI Performance","Wevu Runtime Size"]'), github.event.workflow_run.name) && github.event.workflow_run.event == 'workflow_dispatch'`,
  'report-v2': `contains(fromJSON('["Performance Smoke","Nightly Performance"]'), github.event.workflow_run.name)`,
  'native-pr-report': `(github.event_name == 'workflow_run'
    && github.event.workflow_run.name == 'PR CI'
    && github.event.workflow_run.event == 'pull_request'
    && github.event.workflow_run.conclusion == 'success')
    || (github.event_name == 'workflow_dispatch'
    && github.ref_type == 'branch'
    && github.ref_name == github.event.repository.default_branch)`,
}

/** 统一处理 Actions 允许的字符串、数组和映射触发语法，避免漏掉简写入口。 */
function events(value) {
  if (typeof value === 'string' || Array.isArray(value)) {
    return Object.fromEntries(list(value).map(name => [name, null]))
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError('workflow 缺少有效的 on 配置')
  }
  return value
}

export async function readLocalAdmission(root) {
  const github = path.join(root, '.github')
  const policy = JSON.parse(await readFile(path.join(github, 'pr-admission.json'), 'utf8'))
  if (!policy || typeof policy.environment !== 'string' || !policy.environment
    || !Array.isArray(policy.reviewers) || policy.reviewers.length === 0 || policy.reviewers.some(value => typeof value !== 'string' || !value)
    || new Set(policy.reviewers).size !== policy.reviewers.length
    || typeof policy.preventSelfReview !== 'boolean' || typeof policy.canAdminsBypass !== 'boolean'
    || !Number.isSafeInteger(policy.waitTimer) || policy.waitTimer < 0
    || policy.deploymentBranchPolicy !== null || typeof policy.forkApprovalPolicy !== 'string') {
    throw new TypeError('无效的 .github/pr-admission.json 审批配置')
  }
  const profiles = JSON.parse(await readFile(path.join(github, 'pr-checks.json'), 'utf8'))
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles) || Object.keys(profiles).length === 0) {
    throw new TypeError('无效的 .github/pr-checks.json 检查清单')
  }
  const directory = path.join(github, 'workflows')
  const workflows = {}
  for (const name of sorted((await readdir(directory)).filter(name => /\.ya?ml$/u.test(name)))) {
    workflows[name] = parse(await readFile(path.join(directory, name), 'utf8'))
  }
  return { policy, profiles, workflows }
}

/** 核对审批入口及依赖边界；新增任务必须显式登记，不能成为审批前的独立根节点。 */
export function checkLocalAdmission({ policy, profiles, workflows }) {
  const results = []
  const add = (name, expected, actual) => results.push(check(name, expected, actual))
  const triggers = Object.fromEntries(Object.entries(workflows).map(([name, workflow]) => [name, events(workflow?.on)]))
  const listeners = event => sorted(Object.keys(triggers).filter(name => Object.hasOwn(triggers[name], event)))
  add('唯一 PR 入口', ['ci-pr.yml'], listeners('pull_request'))
  add('唯一关闭事件入口', ['ci-pr.yml'], listeners('pull_request_target'))
  for (const event of ['pull_request_review', 'pull_request_review_comment']) {
    add(`${event} 不另行启动检查`, [], listeners(event))
  }
  const pr = workflows['ci-pr.yml'] ?? {}
  add('原生入口名称', 'PR CI', pr.name)
  add('原生触发事件', {
    pull_request: { types: ['opened', 'synchronize', 'reopened'] },
    pull_request_target: { types: ['closed'] },
  }, triggers['ci-pr.yml'])
  add('PR 并发隔离与旧运行取消', {
    'group': 'pr-ci-${{ github.event.pull_request.number }}',
    'cancel-in-progress': true,
  }, pr.concurrency)
  const jobs = pr.jobs ?? {}
  const { approval = {}, plan = {}, ...validations } = jobs
  add('单一审批后的任务清单', sorted(Object.keys(profiles)), sorted(Object.keys(validations)))
  add('审批 Environment', policy.environment, typeof approval.environment === 'object' ? approval.environment?.name : approval.environment)
  add('关闭事件跳过审批', expression('github.event_name == \'pull_request\''), expression(approval.if))
  add('审批为唯一根任务', [], list(approval.needs))
  add('审批任务不调用其他 workflow', undefined, approval.uses)
  add('冻结目标等待审批', ['approval'], list(plan.needs))
  add('冻结目标不覆盖默认依赖条件', undefined, plan.if)
  for (const [name, job] of Object.entries(jobs)) {
    add(`${name} 不绕过跳过或取消的依赖`, false, /\b(?:always|cancelled|failure)\s*\(/u.test(job.if ?? ''))
    if (name === 'approval' || name === 'plan') {
      continue
    }
    add(`${name} 等待冻结目标`, ['plan'], list(job.needs))
    add(`${name} 使用登记的验证流程`, `./.github/workflows/validate-${name}.yml`, job.uses)
    add(`${name} 使用冻结的检查选择`, expression(`fromJSON(needs.plan.outputs.pr_context).selections['${name}']`), expression(job.if))
    add(`${name} 验证流程存在`, true, Boolean(workflows[`validate-${name}.yml`]?.on?.workflow_call))
  }
  add('完整性能验收不纳入 PR 审批', [], Object.entries(jobs)
    .filter(([name, job]) => /nightly-performance/u.test(name) || /nightly-performance/u.test(job.uses ?? ''))
    .map(([name]) => name))
  const reporters = Object.keys(triggers).filter((name) => {
    const run = triggers[name].workflow_run
    return run && list(run.workflows).some(workflow => workflow === pr.name || /[*?[]/u.test(workflow))
  })
  add('原生完成报告入口', ['ci-performance-comment.yml'], sorted(reporters))
  const report = workflows['ci-performance-comment.yml'] ?? {}
  add('报告仅监听完成事件', ['completed'], list(triggers['ci-performance-comment.yml']?.workflow_run?.types))
  add('原生报告任务清单', sorted(Object.keys(reportGuards)), sorted(Object.keys(report.jobs ?? {})))
  for (const [name, guard] of Object.entries(reportGuards)) {
    add(`${name} 报告准入条件`, expression(guard), expression(report.jobs?.[name]?.if))
  }
  return results
}
