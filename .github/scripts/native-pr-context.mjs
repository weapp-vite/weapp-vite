import assert from 'node:assert/strict'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { requiredDocumentContracts, rootDocumentationChanges } from '../../scripts/verification/documentPolicy.mjs'
import { validateNativeContextShape, validateNativeRunIdentity } from './native-pr-identity.mjs'
import { isNativePrContext, resolveNativeRefreshContext } from './native-pr-refresh.mjs'
import { readNativeSnapshotFiles, resolveNativeSnapshotContext } from './native-pr-snapshot.mjs'
import { readNativePrWorkload, selectNativePrWorkload } from './native-pr-workload.mjs'
import { matchesFilters } from './pr-context.mjs'
import { samePullIdentity } from './pr-target-identity.mjs'

/** 原生 PR 运行绑定触发事件中的提交，审批等待不能把旧运行改测新提交。 */
export function validateNativePrContext(context, run, repository, defaultBranch) {
  validateNativeContextShape(context)
  if (context.repository !== repository) {
    throw new Error('Untrusted native PR context')
  }
  validateNativeRunIdentity(context, run, repository, false, defaultBranch)
  return context
}

/** 路径和分支过滤只在统一入口计算一次，所有子流程共享同一轮冻结身份。 */
export async function resolveNativePrContext({ repository, runId, runAttempt = 1, driverSha, event, profiles, eventName = 'pull_request', refName }, get) {
  let context
  let identities
  if (eventName === 'workflow_dispatch') {
    context = await resolveNativeRefreshContext({ repository, runId, runAttempt, driverSha, refName, event }, get)
    identities = { baseRepositoryId: context.baseRepositoryId, headRepositoryId: context.headRepositoryId }
  }
  else {
    assert.equal(eventName, 'pull_request', 'Expected a pull_request event for this repository')
    const snapshot = await resolveNativeSnapshotContext({ repository, runId, runAttempt, driverSha, event }, get)
    context = snapshot.context
    identities = snapshot.identities
  }
  const workload = await readNativePrWorkload(context.checkoutSha, profiles, get)
  const { files, truncated } = await readNativeSnapshotFiles(context, get)
  const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean))
  const documentationPaths = truncated || workload.value.pullRequests.includes(context.prNumber) ? null : rootDocumentationChanges(files)
  const documentationOnly = documentationPaths !== null
  const pathSelections = Object.fromEntries(Object.entries(profiles).map(([name, profile]) => [name, matchesFilters([context.baseRef], profile.baseBranches)
    && !documentationOnly && (truncated || matchesFilters(paths, profile.paths))]))
  const selection = selectNativePrWorkload(context, profiles, pathSelections, workload)
  const current = await get(`/pulls/${context.prNumber}`)
  if (!samePullIdentity(current, context, identities)) {
    throw new Error('PR changed while selecting checks; approve the new run')
  }
  if (context.event === 'native_refresh') {
    const base = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
    const mergeRef = await get(`/git/ref/pull/${context.prNumber}/merge`)
    assert(base.object?.sha === context.baseSha && mergeRef.ref === `refs/pull/${context.prNumber}/merge`
      && mergeRef.object?.sha === context.checkoutSha, 'PR changed while selecting checks; approve the new run')
  }
  return { ...context, ...selection, documentationOnly, documentationPaths: documentationPaths ?? [], documentationChecks: documentationOnly ? requiredDocumentContracts(paths) : [] }
}

/** 拓扑选择与审批后冻结上下文一致，调用层不能把候选偷偷改回默认。 */
export function assertPrTopology(context, topology) {
  assert(['legacy-v1', 'optimized-v1', 'optimized-v2'].includes(topology), 'Unsupported verification topology')
  if (isNativePrContext(context)) {
    assert.equal(topology, context.verificationTopology ?? 'optimized-v1', 'Frozen verification topology mismatch')
  }
}

/** 子流程只投影固定上下文，不重新请求 PR，也不重复发布 artifact 或提交状态。 */
export function projectPrContext(context, profile, name) {
  if (context.schemaVersion !== 1 || typeof context.isPr !== 'boolean' || typeof context.shouldRun !== 'boolean'
    || !/^[a-f\d]{40}$/u.test(context.checkoutSha) || !profile) {
    throw new Error('Invalid frozen PR context')
  }
  if (isNativePrContext(context) && typeof context.selections?.[name] !== 'boolean') {
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
    const context = JSON.parse(process.env.PR_FROZEN_CONTEXT)
    assertPrTopology(context, process.env.PR_VERIFICATION_TOPOLOGY ?? 'optimized-v1')
    await outputs(projectPrContext(context, profiles[process.env.PR_PROFILE], process.env.PR_PROFILE))
    return
  }
  if (!['pull_request', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) {
    throw new Error('Native PR planning requires pull_request or protected refresh')
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
  const context = await resolveNativePrContext({ repository, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, driverSha: process.env.GITHUB_SHA, event, profiles, eventName: process.env.GITHUB_EVENT_NAME, refName: process.env.GITHUB_REF }, get)
  await mkdir('.tmp/pr-context', { recursive: true })
  await writeFile('.tmp/pr-context/context.json', `${JSON.stringify(context, null, 2)}\n`)
  await outputs(context)
  const rows = Object.entries(profiles).map(([name, profile]) => `| ${profile.name} | ${context.selections[name] ? 'Selected' : 'Skipped by path/branch filters'} | ${context.selectionSources[name]} |`)
  const benchmark = context.benchmarkWorkload
  const receipt = benchmark ? `\n\nBenchmark workload: \`${benchmark.id}\`\n\nManifest SHA-256: \`${benchmark.manifest.sha256}\`` : ''
  const scope = context.event === 'pull_request'
    ? 'This run validates only the approved immutable snapshot. A strict required status check must enforce up-to-date branches before merge.'
    : 'This run validates its independently approved pinned refresh target.'
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Approved PR #${context.prNumber}\n\n${scope}\n\nTopology: \`${context.verificationTopology}\`\n\nHEAD: \`${context.headSha}\`\n\nBASE: \`${context.baseSha}\`\n\nMERGE: \`${context.checkoutSha}\`${receipt}\n\n| Check | Selection | Source |\n| --- | --- | --- |\n${rows.join('\n')}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
