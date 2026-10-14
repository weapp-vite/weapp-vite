import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function sha(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{40}$/u.test(value)) {
    throw new Error('Expected a full commit SHA')
  }
  return value
}

function patterns(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value ?? []
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string' || !item)) {
    throw new Error('Path and branch filters must be arrays of patterns')
  }
  return parsed
}

/** 按 GitHub 的顺序匹配规则保留正向与排除路径过滤。 */
export function matchesFilters(values, filters) {
  if (!filters.length) {
    return true
  }
  return values.some((value) => {
    let matched = false
    for (const filter of filters) {
      const negative = filter.startsWith('!')
      if (path.matchesGlob(value, negative ? filter.slice(1) : filter)) {
        matched = !negative
      }
    }
    return matched
  })
}

/** 手动 PR 验证只读解析一次目标，后续任务消费固定的提交信息。 */
export async function resolvePrContext({ repository, runId, driverSha, refName, prNumber = '', paths = [], baseBranches = [], checkoutMode = 'merge' }, get) {
  if (!['head', 'merge'].includes(checkoutMode)) {
    throw new Error('PR checkout mode must be head or merge')
  }
  const context = {
    schemaVersion: 1,
    repository,
    runId: String(runId),
    driverSha: sha(driverSha),
    isPr: false,
    shouldRun: true,
    prNumber: null,
    headSha: sha(driverSha),
    baseSha: '',
    headRef: refName,
    baseRef: '',
    headRepository: repository,
    checkoutSha: sha(driverSha),
    checkoutMode: 'ref',
  }
  const input = String(prNumber).trim()
  if (!input) {
    return context
  }
  if (!/^[1-9]\d*$/u.test(input) || !Number.isSafeInteger(Number(input))) {
    throw new Error('pr-number must be a positive PR number')
  }
  const number = Number(input)
  const pull = await get(`/pulls/${number}`)
  if (pull.state !== 'open' || pull.base?.repo?.full_name !== repository || !pull.head?.repo?.full_name) {
    throw new Error('PR must be open and target this repository')
  }
  Object.assign(context, {
    isPr: true,
    prNumber: number,
    headSha: sha(pull.head.sha),
    baseSha: sha(pull.base.sha),
    headRef: pull.head.ref,
    baseRef: pull.base.ref,
    headRepository: pull.head.repo.full_name,
    checkoutSha: sha(pull.head.sha),
    checkoutMode,
  })
  context.shouldRun = matchesFilters([context.baseRef], patterns(baseBranches))
  const pathFilters = patterns(paths)
  if (context.shouldRun && pathFilters.length) {
    const files = []
    for (let page = 1; ; page++) {
      const rows = await get(`/pulls/${number}/files?per_page=100&page=${page}`)
      if (!Array.isArray(rows)) {
        throw new TypeError('Invalid PR changed-files response')
      }
      files.push(...rows)
      if (rows.length < 100 || files.length >= 3000) {
        break
      }
    }
    // API 超过三千条时可能截断；宁可保留验证，不把未知变更当作无关路径。
    context.shouldRun = files.length >= 3000 || matchesFilters(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)), pathFilters)
  }
  if (context.shouldRun && checkoutMode === 'merge') {
    if (!pull.merge_commit_sha) {
      throw new Error('PR has no merge candidate; resolve conflicts or wait for GitHub to calculate it, then dispatch again')
    }
    const mergeSha = sha(pull.merge_commit_sha)
    const merge = await get(`/git/commits/${mergeSha}`)
    if (merge.sha !== mergeSha || merge.parents?.length !== 2
      || merge.parents[0].sha !== context.baseSha || merge.parents[1].sha !== context.headSha) {
      throw new Error('PR merge candidate does not match the frozen head/base; dispatch again')
    }
    context.checkoutSha = mergeSha
  }
  const current = await get(`/pulls/${number}`)
  if (current.state !== 'open' || current.head.sha !== context.headSha || current.base.sha !== context.baseSha) {
    throw new Error('PR changed while resolving its validation target; dispatch again')
  }
  return context
}

/** 可信报告器核对手动运行身份，不能把调度主线 SHA 当作被测 PR SHA。 */
export function validatePrContext(context, run, repository) {
  if (context?.schemaVersion !== 1 || context.repository !== repository || String(context.runId) !== String(run.id)
    || context.driverSha !== run.head_sha || run.event !== 'workflow_dispatch' || context.isPr !== true
    || typeof context.shouldRun !== 'boolean' || !Number.isSafeInteger(context.prNumber) || context.prNumber <= 0
    || typeof context.headRef !== 'string' || !context.headRef || typeof context.baseRef !== 'string' || !context.baseRef
    || typeof context.headRepository !== 'string' || !context.headRepository
    || !['head', 'merge'].includes(context.checkoutMode)
    || (context.checkoutMode === 'head' && context.checkoutSha !== context.headSha)) {
    throw new Error('Untrusted manual PR context')
  }
  sha(context.driverSha)
  sha(context.headSha)
  sha(context.baseSha)
  sha(context.checkoutSha)
  return context
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY
  const get = async (endpoint) => {
    const response = await fetch(`${process.env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}${endpoint}`, {
      headers: {
        'authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'accept': 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${endpoint}`)
    }
    return response.json()
  }
  const context = await resolvePrContext({
    repository,
    runId: process.env.GITHUB_RUN_ID,
    driverSha: process.env.GITHUB_SHA,
    refName: process.env.GITHUB_REF_NAME,
    prNumber: process.env.PR_NUMBER,
    paths: process.env.PR_PATHS,
    baseBranches: process.env.PR_BASE_BRANCHES,
    checkoutMode: process.env.PR_CHECKOUT_MODE || 'merge',
  }, get)
  const outputs = {
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
  if (Object.values(outputs).some(value => typeof value !== 'string' || /[\r\n]/u.test(value))) {
    throw new Error('Invalid PR context output')
  }
  await mkdir('.tmp/pr-context', { recursive: true })
  await writeFile('.tmp/pr-context/context.json', `${JSON.stringify(context, null, 2)}\n`)
  await appendFile(process.env.GITHUB_OUTPUT, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Validation target\n\n${context.isPr ? `PR #${context.prNumber}` : 'Standalone validation'}\n\nDRIVER: \`${context.driverSha}\`\n\nHEAD: \`${context.headSha}\`\n\nBASE: \`${context.baseSha || 'not applicable'}\`\n\nCHECKOUT (${context.checkoutMode}): \`${context.checkoutSha}\`\n\n${context.shouldRun ? 'Selected for validation.' : 'Not applicable under the existing PR path/branch filters.'}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
