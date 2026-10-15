import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { validatePrContext } from './pr-context.mjs'
import { createPrStatusClient } from './pr-status-client.mjs'

const workflows = new Map([
  ['CI', 'ci.yml'],
  ['CI Policy', 'ci-policy.yml'],
  ['CI E2E', 'ci-e2e.yml'],
  ['Create Weapp Vite Smoke', 'ci-create-weapp-vite.yml'],
  ['Acceptance HTTP', 'ci-acceptance-http.yml'],
  ['Acceptance and Agent', 'ci-acceptance.yml'],
  ['Dimina Web Experiment', 'ci-dimina.yml'],
  ['Vite Host Consumer', 'ci-vite-host-consumer.yml'],
  ['VSCode Extension CI', 'ci-vscode-extension.yml'],
  ['Tutorial E2E', 'ci-tutorial-e2e.yml'],
  ['Deploy Website', 'deploy-website.yml'],
  ['Native Addon Correctness', 'native-addon-correctness.yml'],
  ['Performance Smoke', 'ci-performance.yml'],
  ['Wevu Runtime Size', 'wevu-runtime-size.yml'],
  ['Nightly Performance', 'nightly-performance.yml'],
])

function identity(run) {
  const id = String(run.id)
  const attempt = String(run.run_attempt ?? 1)
  if (!/^[1-9]\d*$/u.test(id) || !/^[1-9]\d*$/u.test(attempt)) {
    throw new Error('Invalid workflow run identity')
  }
  return { id, attempt }
}

/** 仅默认分支调度的既定手动检查可以提供 PR 验证结果。 */
export function trustedRun(run, repository, defaultBranch) {
  return workflows.has(run.name) && run.event === 'workflow_dispatch'
    && run.head_branch === defaultBranch && run.head_repository?.full_name === repository
    && run.path === `.github/workflows/${workflows.get(run.name)}`
}

function stateFor(run, context, baseChanged) {
  if (context.resolutionError) {
    return { state: 'error', message: 'PR target could not be resolved; dispatch again' }
  }
  if (run.status === 'completed' && run.conclusion === 'failure') {
    return { state: 'failure', message: baseChanged ? 'Validation failed; base changed' : 'Manual validation failed; inspect the run' }
  }
  if (baseChanged) {
    return { state: 'error', message: 'PR base changed; dispatch again for the current base' }
  }
  if (run.status !== 'completed') {
    return { state: 'pending', message: 'Manual validation is queued or running' }
  }
  if (run.conclusion === 'success' || (run.conclusion === 'skipped' && !context.shouldRun)) {
    return { state: 'success', message: context.shouldRun ? 'Manual validation passed' : 'Not applicable under PR path/branch filters' }
  }
  return {
    state: run.conclusion === 'failure' ? 'failure' : 'error',
    message: `Manual validation ${run.conclusion || 'has no successful conclusion'}; inspect the run`,
  }
}

async function baseChanged(request, repository, context, pull) {
  const ref = await request(`/repos/${repository}/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  if (!/^[a-f\d]{40}$/u.test(ref.object?.sha)) {
    throw new Error('Invalid current PR base branch reference')
  }
  return pull.base.sha !== context.baseSha || ref.object.sha !== context.baseSha
}

function currentPull(pull, context, repository) {
  return pull.state === 'open' && pull.head?.sha === context.headSha
    && pull.head?.repo?.full_name === context.headRepository && pull.base?.repo?.full_name === repository
    && pull.head?.ref === context.headRef && pull.base?.ref === context.baseRef
}

async function latestStatus(request, repository, sha, name) {
  const matches = []
  for (let page = 1; ; page++) {
    const statuses = await request(`/repos/${repository}/commits/${sha}/statuses?per_page=100&page=${page}`)
    if (!Array.isArray(statuses)) {
      throw new TypeError('Invalid commit status response')
    }
    matches.push(...statuses.filter(status => status.context === name))
    if (statuses.length < 100) {
      return matches
    }
  }
}

function alreadyReported(statuses, run, state) {
  const source = identity(run)
  for (const status of statuses) {
    const match = /^run ([1-9]\d*)\/([1-9]\d*): /u.exec(status.description ?? '')
    if (!match) {
      continue
    }
    const newer = BigInt(match[1]) > BigInt(source.id)
      || (match[1] === source.id && BigInt(match[2]) > BigInt(source.attempt))
    if (newer) {
      return 'newer-run'
    }
    if (match[1] === source.id && match[2] === source.attempt && status.state !== 'pending' && state !== 'error') {
      return 'already-final'
    }
  }
  return null
}

function contextProof(context) {
  const fields = ['schemaVersion', 'repository', 'runId', 'runAttempt', 'driverSha', 'isPr', 'shouldRun', 'prNumber', 'headSha', 'baseSha', 'headRef', 'baseRef', 'headRepository', 'checkoutSha', 'checkoutMode', 'resolutionError']
  return createHash('sha256').update(JSON.stringify(fields.map(key => [key, context[key] ?? null]))).digest('hex')
}

function hasReceipt(statuses, run, proof, targetUrl, context) {
  const { id, attempt } = identity(run)
  const originalAttempt = String(context.runAttempt ?? 1)
  return statuses.some((status) => {
    const receiptAttempt = /^run [1-9]\d*\/([1-9]\d*): /u.exec(status.description ?? '')?.[1]
    return [attempt, originalAttempt].includes(receiptAttempt)
      && status.creator?.login === 'github-actions[bot]' && status.creator?.type === 'Bot'
      && status.target_url === targetUrl.replace(`/attempts/${attempt}`, `/attempts/${receiptAttempt}`)
      && status.description?.startsWith(`run ${id}/${receiptAttempt}: proof ${proof}; `)
      && (status.state === 'pending' || (context.resolutionError && status.state === 'error'))
  })
}

/** 可信调度器把手动验证状态写到固定 PR HEAD，并拒绝旧运行覆盖新结果。 */
export async function publishPrStatus({ repository, run, context, defaultBranch, request, verifyContext, serverUrl = 'https://github.com', phase = 'completion' }) {
  if (!['pending', 'completion'].includes(phase)) {
    throw new Error('Invalid PR status publication phase')
  }
  if (!trustedRun(run, repository, defaultBranch)) {
    throw new Error('PR status requires a trusted default-branch manual workflow')
  }
  identity(run)
  if (context?.isPr === false) {
    return { published: false, reason: 'standalone' }
  }
  validatePrContext(context, run, repository)
  if (!/^[1-9]\d*$/u.test(String(context.runAttempt ?? 1)) || BigInt(context.runAttempt ?? 1) > BigInt(identity(run).attempt)) {
    return { published: false, reason: 'stale-attempt' }
  }
  const name = `Manual PR / ${run.name}`
  const { id, attempt } = identity(run)
  const targetUrl = `${serverUrl.replace(/\/$/u, '')}/${repository}/actions/runs/${id}/attempts/${attempt}`
  const proof = contextProof(context)
  let pull = await request(`/repos/${repository}/pulls/${context.prNumber}`)
  if (!currentPull(pull, context, repository)) {
    return { published: false, reason: 'stale-pr' }
  }
  const previous = await latestStatus(request, repository, context.headSha, name)
  if (phase === 'completion' && !hasReceipt(previous, run, proof, targetUrl, context)) {
    if (!verifyContext) {
      return { published: false, reason: 'missing-trusted-receipt' }
    }
    // 历史运行没有首次状态；必须由可信 resolver 日志证明 artifact 的不可变身份。
    const verified = await verifyContext(run, defaultBranch)
    if (contextProof(verified) !== proof) {
      throw new Error('PR context changed while verifying its source')
    }
  }
  const moved = await baseChanged(request, repository, context, pull)
  const blocked = alreadyReported(previous, run, stateFor(run, context, moved).state)
  if (blocked) {
    return { published: false, reason: blocked }
  }
  // 状态 API 没有条件写入；发送前再读取运行、PR 与状态，缩小并发通知的竞争窗口。
  const currentRun = await request(`/repos/${repository}/actions/runs/${run.id}`)
  if (!trustedRun(currentRun, repository, defaultBranch) || currentRun.head_sha !== run.head_sha
    || String(currentRun.id) !== String(run.id) || identity(currentRun).attempt !== identity(run).attempt) {
    return { published: false, reason: 'stale-attempt' }
  }
  pull = await request(`/repos/${repository}/pulls/${context.prNumber}`)
  if (!currentPull(pull, context, repository)) {
    return { published: false, reason: 'stale-pr' }
  }
  const statuses = await latestStatus(request, repository, context.headSha, name)
  const currentBaseChanged = await baseChanged(request, repository, context, pull)
  const result = phase === 'pending' && !context.resolutionError && !currentBaseChanged
    ? { state: 'pending', message: 'Queued or running' }
    : stateFor(currentRun, context, currentBaseChanged)
  const changed = alreadyReported(statuses, currentRun, result.state)
  if (changed) {
    return { published: false, reason: changed }
  }
  const body = {
    state: result.state,
    context: name,
    description: `run ${id}/${attempt}: proof ${proof}; ${result.message}`.slice(0, 140),
    target_url: targetUrl,
  }
  const latest = statuses.find(status => status.context === name)
  if (latest?.state === body.state && latest.description === body.description && latest.target_url === targetUrl) {
    return { published: false, reason: 'unchanged' }
  }
  await request(`/repos/${repository}/statuses/${context.headSha}`, { method: 'POST', body })
  return { published: true, state: result.state, context: name, targetUrl }
}

async function main() {
  const token = required('GITHUB_TOKEN')
  const repository = required('GITHUB_REPOSITORY')
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const { request, readContext, verifyContext } = createPrStatusClient({ apiUrl, token, repository })
  const runId = process.env.PR_STATUS_RUN_ID?.trim() || required('GITHUB_RUN_ID')
  if (!/^[1-9]\d*$/u.test(runId)) {
    throw new Error('Invalid workflow run ID')
  }
  const repo = await request(`/repos/${repository}`)
  const run = await request(`/repos/${repository}/actions/runs/${runId}`)
  if (!trustedRun(run, repository, repo.default_branch)) {
    throw new Error('PR status requires a trusted default-branch manual workflow')
  }
  let context
  try {
    context = process.env.PR_STATUS_CONTEXT_PATH
      ? JSON.parse(await readFile(process.env.PR_STATUS_CONTEXT_PATH, 'utf8'))
      : await readContext(run)
  }
  catch (error) {
    if (!process.env.PR_STATUS_CONTEXT_PATH && error.code === 'PR_CONTEXT_MISSING') {
      process.stdout.write(`${JSON.stringify({ published: false, reason: 'missing-artifact' })}\n`)
      return
    }
    throw error
  }
  const phase = process.env.PR_STATUS_CONTEXT_PATH ? process.env.PR_STATUS_PHASE || 'pending' : 'completion'
  const result = await publishPrStatus({ repository, run, context, defaultBranch: repo.default_branch, request, verifyContext, serverUrl: process.env.GITHUB_SERVER_URL, phase })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
