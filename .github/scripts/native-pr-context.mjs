import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { matchesFilters, resolvePrContext } from './pr-context.mjs'

/** 原生 PR 运行绑定触发事件中的提交，审批等待不能把旧运行改测新提交。 */
export function validateNativePrContext(context, run, repository) {
  const pull = run.pull_requests?.find(pull => pull.number === context?.prNumber)
  if (run.event !== 'pull_request' || context?.event !== 'pull_request' || context.schemaVersion !== 1
    || context.repository !== repository || String(context.runId) !== String(run.id)
    || context.headSha !== run.head_sha || context.isPr !== true
    || !Number.isSafeInteger(context.prNumber) || context.prNumber <= 0
    || !pull || pull.head?.sha !== context.headSha || pull.base?.sha !== context.baseSha
    || pull.head?.ref !== context.headRef || pull.base?.ref !== context.baseRef
    || !/^[a-f\d]{40}$/u.test(context.headSha) || !/^[a-f\d]{40}$/u.test(context.baseSha)
    || !/^[a-f\d]{40}$/u.test(context.checkoutSha)
    || context.checkoutMode !== 'merge' || context.checkoutSha !== context.driverSha
    || typeof context.headRepository !== 'string' || !context.headRepository
    || typeof context.selections !== 'object' || !context.selections) {
    throw new Error('Untrusted native PR context')
  }
  return context
}

/** 路径和分支过滤只在统一入口计算一次，所有子流程共享同一轮冻结身份。 */
export async function resolveNativePrContext({ repository, runId, runAttempt = 1, driverSha, event, profiles }, get) {
  const pull = event.pull_request
  if (!pull || pull.base?.repo?.full_name !== repository || !pull.head?.repo?.full_name
    || !Number.isSafeInteger(event.number) || event.number !== pull.number) {
    throw new Error('Expected a pull_request event for this repository')
  }
  const context = await resolvePrContext({ repository, runId, runAttempt, driverSha, refName: pull.head.ref, prNumber: event.number }, get)
  if (context.headSha !== pull.head.sha || context.baseSha !== pull.base.sha
    || context.headRepository !== pull.head.repo.full_name || context.checkoutSha !== driverSha) {
    throw new Error('PR changed while waiting for approval; approve the new run')
  }
  const files = []
  for (let page = 1; ; page++) {
    const rows = await get(`/pulls/${event.number}/files?per_page=100&page=${page}`)
    if (!Array.isArray(rows)) {
      throw new TypeError('Invalid PR changed-files response')
    }
    files.push(...rows)
    if (rows.length < 100 || files.length >= 3000) {
      break
    }
  }
  const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean))
  const selections = Object.fromEntries(Object.entries(profiles).map(([name, profile]) => [name, matchesFilters([context.baseRef], profile.baseBranches)
    && (files.length >= 3000 || matchesFilters(paths, profile.paths))]))
  const current = await get(`/pulls/${event.number}`)
  const base = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  if (current.state !== 'open' || current.head.sha !== context.headSha || current.base.sha !== context.baseSha || base.object?.sha !== context.baseSha) {
    throw new Error('PR changed while selecting checks; approve the new run')
  }
  return { ...context, event: 'pull_request', selections }
}

/** 子流程只投影固定上下文，不重新请求 PR，也不重复发布 artifact 或提交状态。 */
export function projectPrContext(context, profile, name) {
  if (context.schemaVersion !== 1 || typeof context.isPr !== 'boolean' || typeof context.shouldRun !== 'boolean'
    || !/^[a-f\d]{40}$/u.test(context.checkoutSha) || !profile) {
    throw new Error('Invalid frozen PR context')
  }
  if (context.event === 'pull_request' && typeof context.selections?.[name] !== 'boolean') {
    throw new Error('Missing native PR profile selection')
  }
  return {
    ...context,
    shouldRun: context.selections?.[name] ?? context.shouldRun,
    ...(context.isPr && profile.checkoutMode === 'head' ? { checkoutMode: 'head', checkoutSha: context.headSha } : {}),
  }
}

async function outputs(context) {
  const values = {
    pr_context: JSON.stringify(context),
    is_pr: String(context.isPr),
    should_run: String(context.shouldRun),
    pr_number: context.prNumber === null ? '' : String(context.prNumber),
    head_sha: context.headSha,
    base_sha: context.baseSha,
    head_ref: context.headRef,
    base_ref: context.baseRef,
    head_repository: context.headRepository,
    checkout_sha: context.checkoutSha,
  }
  if (Object.values(values).some(value => typeof value !== 'string' || /[\r\n]/u.test(value))) {
    throw new Error('Invalid frozen context output')
  }
  await appendFile(process.env.GITHUB_OUTPUT, `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n')}\n`)
}

async function main() {
  const profiles = JSON.parse(await readFile(new URL('../pr-checks.json', import.meta.url), 'utf8'))
  if (process.env.PR_FROZEN_CONTEXT) {
    await outputs(projectPrContext(JSON.parse(process.env.PR_FROZEN_CONTEXT), profiles[process.env.PR_PROFILE], process.env.PR_PROFILE))
    return
  }
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    throw new Error('Native PR planning requires pull_request')
  }
  const repository = process.env.GITHUB_REPOSITORY
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const get = async (endpoint) => {
    const response = await fetch(`${process.env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}${endpoint}`, {
      headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${endpoint}`)
    }
    return response.json()
  }
  const context = await resolveNativePrContext({ repository, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, driverSha: process.env.GITHUB_SHA, event, profiles }, get)
  await mkdir('.tmp/pr-context', { recursive: true })
  await writeFile('.tmp/pr-context/context.json', `${JSON.stringify(context, null, 2)}\n`)
  await outputs(context)
  const rows = Object.entries(profiles).map(([name, profile]) => `| ${profile.name} | ${context.selections[name] ? 'Selected' : 'Skipped by path/branch filters'} |`)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Approved PR #${context.prNumber}\n\nHEAD: \`${context.headSha}\`\n\nBASE: \`${context.baseSha}\`\n\nMERGE: \`${context.checkoutSha}\`\n\n| Check | Selection |\n| --- | --- |\n${rows.join('\n')}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
