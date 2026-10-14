import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { aggregatePlan } from './aggregate.mjs'
import { assertSha, createMatrix, frozenManifest, policy, statusContext, targetKey } from './contract.mjs'
import { pages, request } from './github.mjs'
import { validatePlan } from './publish.mjs'
import { previousAttempt } from './schedule.mjs'

/** 候选采样只接受本轮实际执行的提交，不解析移动分支，也不冒充 main。 */
export function candidateInvocation(env = process.env) {
  const sha = assertSha(env.CANDIDATE_SHA)
  if (sha !== assertSha(env.GITHUB_SHA)
    || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '')
    || (env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
      && !(env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/tags/codex/performance-candidate/${sha}`))) {
    throw new Error('Candidate performance requires an explicit immutable candidate invocation')
  }
  if (!/^refs\/(?:heads|tags)\/.+/.test(env.GITHUB_REF ?? '')) {
    throw new Error('Missing candidate workflow ref')
  }
  return { sha, repository: env.GITHUB_REPOSITORY, event: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF }
}

/** 复用只能下载同仓已登记运行的证据，不能从任意状态链接读取文件。 */
export function previousRunId(target, repository, server = process.env.GITHUB_SERVER_URL ?? 'https://github.com') {
  const prefix = `${server}/${repository}/actions/runs/`
  const url = target.previous?.url
  if (typeof url !== 'string' || !url.startsWith(prefix) || !/^[1-9]\d*$/.test(url.slice(prefix.length))) {
    throw new Error('Untrusted previous candidate evidence URL')
  }
  return url.slice(prefix.length)
}

/** 成功状态只用于定位历史运行；结论仍从保留的原始分片重新计算。 */
async function verifyPreviousEvidence(target, repository, root, get) {
  const run = await get(`/actions/runs/${previousRunId(target, repository)}`)
  if (run.html_url !== target.previous.url || run.head_repository?.full_name !== repository) {
    throw new Error('Previous performance run identity mismatch')
  }
  const previousRoot = path.join(root, 'previous')
  const plan = JSON.parse(await readFile(path.join(previousRoot, 'performance-plan/plan.json'), 'utf8'))
  if (plan.execution === 'candidate') {
    validatePlan(plan, run, repository, { candidate: true })
  }
  else {
    const repo = await get('')
    if (run.name !== 'Nightly Performance' || run.path !== '.github/workflows/nightly-performance.yml'
      || !['schedule', 'workflow_dispatch'].includes(run.event) || run.head_branch !== repo.default_branch) {
      throw new Error('Previous performance requires a trusted Nightly run')
    }
    validatePlan(plan, run, repository)
  }
  if (plan.samplingContract !== policy.samplingContract) {
    throw new Error('Previous performance sampling contract mismatch')
  }
  const matches = plan.targets.filter(row => row.key === target.key && row.headRepository === repository)
  if (matches.length !== 1) {
    throw new Error('Previous performance did not collect this candidate')
  }
  const report = await aggregatePlan({ ...plan, targets: matches }, previousRoot)
  return report.targets[0]?.status === 'passed'
}

/** 同一候选沿用原有提交状态；失败、取消及运行中记录均不得自动重采样。 */
export async function createCandidatePlan(env = process.env, get = request) {
  const invocation = candidateInvocation(env)
  const commit = await get(`/commits/${invocation.sha}`)
  if (commit.sha !== invocation.sha) {
    throw new Error('Candidate commit identity mismatch')
  }
  const target = {
    kind: 'candidate',
    id: `candidate-${invocation.sha}`,
    prNumber: null,
    headSha: invocation.sha,
    headRepository: invocation.repository,
    baselineSha: policy.baselineSha,
  }
  target.key = targetKey(target)
  const previous = await previousAttempt(target, get)
  const targets = previous ? [] : [target]
  const reused = previous ? [{ ...target, previous: { state: previous.state, url: previous.target_url } }] : []
  return {
    schemaVersion: 2,
    purpose: 'full',
    execution: 'candidate',
    invocation: { event: invocation.event, ref: invocation.ref },
    samplingContract: policy.samplingContract,
    manifest: frozenManifest(),
    driverSha: invocation.sha,
    repository: invocation.repository,
    runId: env.GITHUB_RUN_ID,
    targets,
    reused,
    matrix: createMatrix(targets),
  }
}

/** 在发布状态前重读全部原始分片，并核对同一运行登记的状态来源。 */
export async function publishCandidatePlan(plan, run, root, get = request) {
  validatePlan(plan, run, plan.repository, { candidate: true })
  const report = await aggregatePlan(plan, root)
  let passed = true
  for (const target of report.targets) {
    const context = statusContext(target)
    const statuses = await pages(`/commits/${target.headSha}/statuses`, get)
    if (!statuses.some(status => status.context === context && status.target_url === run.html_url && status.creator?.type === 'Bot')) {
      throw new Error('Missing trusted candidate attempt registration')
    }
    const success = target.status === 'passed'
    passed &&= success
    await get(`/statuses/${target.headSha}`, {
      context,
      state: success ? 'success' : 'failure',
      target_url: run.html_url,
      description: success ? '候选提交完整三平台性能通过' : `候选提交完整性能未通过：${target.status}`,
    })
  }
  for (const target of plan.reused) {
    const statuses = await pages(`/commits/${target.headSha}/statuses`, get)
    const previous = statuses.find(status => status.context === statusContext(target))
    const trusted = previous?.state === 'success' && previous.target_url === target.previous.url && previous.creator?.type === 'Bot'
    passed &&= trusted && await verifyPreviousEvidence(target, plan.repository, root, get)
  }
  return passed
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'plan') {
    const plan = await createCandidatePlan()
    const url = `${process.env.GITHUB_SERVER_URL}/${plan.repository}/actions/runs/${plan.runId}`
    await mkdir('performance-plan', { recursive: true })
    await writeFile('performance-plan/plan.json', `${JSON.stringify(plan, null, 2)}\n`)
    for (const target of plan.targets) {
      await request(`/statuses/${target.headSha}`, {
        state: 'pending',
        context: statusContext(target),
        target_url: url,
        description: '冻结候选提交，完整三平台性能验收排队',
      })
    }
    const previous = plan.reused.find(target => target.previous.state === 'success')
    await appendFile(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include: plan.matrix })}\nhas_work=${plan.matrix.length > 0}\nprevious_run_id=${previous ? previousRunId(previous, plan.repository) : ''}\n`)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 候选提交性能计划\n\nHEAD: \`${plan.driverSha}\`；固定基线: \`${policy.baselineSha}\`。\n\n${plan.reused.map(target => `复用[已有结果](${target.previous.url})（${target.previous.state}），不重复采样。`).join('\n')}\n`)
  }
  else if (mode === 'publish') {
    const root = path.resolve(process.env.PERFORMANCE_ARTIFACTS)
    const plan = JSON.parse(await readFile(path.join(root, 'performance-plan/plan.json'), 'utf8'))
    const run = await request(`/actions/runs/${process.env.GITHUB_RUN_ID}`)
    process.exitCode = await publishCandidatePlan(plan, run, root) ? 0 : 1
  }
  else {
    throw new Error('Usage: candidate.mjs plan|publish')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
