import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { validatePrContext } from './pr-context.mjs'

const workflowNames = ['CI Performance', 'Wevu Runtime Size']

/** 性能报告仍使用 PR 本身的 HEAD，不能把普通 CI 的 merge 候选混入比较。 */
export function validatePerformancePrContext(context, run, repository) {
  validatePrContext(context, run, repository)
  if (context.checkoutMode !== 'head' || context.checkoutSha !== context.headSha) {
    throw new Error('Performance reports require a frozen PR head checkout')
  }
  return context
}

/** 只读取指定运行的固定上下文，不解压或执行候选提交中的脚本。 */
export async function downloadPrContext({
  apiUrl,
  token,
  repository,
  run,
  artifact = /** @type {{id: number | string, name: string, expired?: boolean, digest?: string} | undefined} 可选的已解析附件；省略时按运行查询。 */ (undefined),
  request = githubRequest,
}) {
  if (!artifact) {
    const result = await request(apiUrl, token, `/repos/${repository}/actions/runs/${run.id}/artifacts?name=pr-context&per_page=100`)
    if (!Array.isArray(result.artifacts)) {
      throw new TypeError('Invalid manual PR context artifact listing')
    }
    const artifacts = result.artifacts.filter(candidate => candidate.name === 'pr-context' && !candidate.expired)
    if (!artifacts.length) {
      throw Object.assign(new Error('Manual PR context artifact is not available'), { code: 'PR_CONTEXT_MISSING' })
    }
    if (artifacts.length !== 1) {
      throw new Error('Missing unique manual PR context artifact')
    }
    artifact = artifacts[0]
  }
  if (!/^[1-9]\d*$/u.test(String(artifact.id)) || artifact.name !== 'pr-context' || artifact.expired) {
    throw new Error('Invalid manual PR context artifact')
  }
  const response = await fetch(`${apiUrl}/repos/${repository}/actions/artifacts/${artifact.id}/zip`, { headers: headers(token), signal: AbortSignal.timeout(30_000) })
  if (!response.ok) {
    throw new Error(`GitHub artifact API ${response.status}`)
  }
  const archive = await response.arrayBuffer()
  if (archive.byteLength > 1_048_576) {
    throw new Error('Manual PR context artifact is too large')
  }
  if (artifact.digest && artifact.digest !== `sha256:${createHash('sha256').update(new Uint8Array(archive)).digest('hex')}`) {
    throw new Error('Manual PR context artifact digest does not match the authenticated upload')
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pr-context-'))
  try {
    const filename = path.join(directory, 'context.zip')
    await writeFile(filename, new Uint8Array(archive))
    // Ubuntu 报告任务提供 unzip；-p 只读取一个文件，不按 artifact 路径写入磁盘。
    const { stdout } = await promisify(execFile)('unzip', ['-p', filename, 'context.json'], { timeout: 10_000, maxBuffer: 65_536 })
    return JSON.parse(stdout)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function trustedRun(run, defaultBranch, repository) {
  const file = run.name === 'Wevu Runtime Size' ? 'wevu-runtime-size.yml' : 'ci-performance.yml'
  return workflowNames.includes(run.name) && run.event === 'workflow_dispatch' && run.status === 'completed'
    && run.head_branch === defaultBranch && run.head_repository?.full_name === repository
    && run.path === `.github/workflows/${file}`
}

/** 将手动运行的调度身份与被测 PR 身份分别校验，防止报告错挂到 main。 */
export async function resolvePerformanceRuns({ apiUrl, token, repository, run, request = githubRequest, readContext = downloadPrContext }) {
  const repo = await request(apiUrl, token, `/repos/${repository}`)
  if (!trustedRun(run, repo.default_branch, repository)) {
    throw new Error('Performance reporting requires a trusted default-branch manual run')
  }
  const input = await readContext({ apiUrl, token, repository, run, request })
  if (!input.isPr) {
    return null
  }
  const context = validatePerformancePrContext(input, run, repository)
  if (!context.shouldRun || context.headRef.startsWith('release/pnpm-version')) {
    return null
  }
  const pull = await request(apiUrl, token, `/repos/${repository}/pulls/${context.prNumber}`)
  if (pull.state !== 'open' || pull.head?.sha !== context.headSha || pull.base?.sha !== context.baseSha || pull.head?.repo?.full_name !== context.headRepository) {
    return null
  }
  const result = await request(apiUrl, token, `/repos/${repository}/actions/runs?event=workflow_dispatch&status=completed&per_page=100`)
  const runs = [run, ...(result.workflow_runs ?? []).filter(candidate => candidate.id !== run.id)]
    .filter(candidate => trustedRun(candidate, repo.default_branch, repository))
    .sort((a, b) => Date.parse(b.updated_at ?? b.created_at ?? '') - Date.parse(a.updated_at ?? a.created_at ?? ''))
  const matching = new Map()
  for (const candidate of runs) {
    if (matching.has(candidate.name)) {
      continue
    }
    try {
      const metadata = candidate.id === run.id ? context : validatePerformancePrContext(await readContext({ apiUrl, token, repository, run: candidate, request }), candidate, repository)
      if (metadata.shouldRun && metadata.prNumber === context.prNumber && metadata.headSha === context.headSha
        && metadata.baseSha === context.baseSha && metadata.headRepository === context.headRepository) {
        matching.set(candidate.name, candidate)
      }
    }
    catch {
      // 旧运行、已过期 artifact 或错误上下文不能为当前 PR 提供验证结果。
    }
  }
  return { context, performanceRun: matching.get('CI Performance'), runtimeRun: matching.get('Wevu Runtime Size') }
}

async function main() {
  const event = JSON.parse(required('WORKFLOW_EVENT_JSON'))
  const resolved = await resolvePerformanceRuns({ apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com', token: required('GITHUB_TOKEN'), repository: required('GITHUB_REPOSITORY'), run: event.workflow_run })
  const outputs = { pr_number: '' }
  if (resolved) {
    Object.assign(outputs, { pr_number: String(resolved.context.prNumber), head_sha: resolved.context.headSha, base_sha: resolved.context.baseSha })
    for (const [kind, run] of [['performance', resolved.performanceRun], ['runtime', resolved.runtimeRun]]) {
      Object.assign(outputs, {
        [`${kind}_run_id`]: run ? String(run.id) : '',
        [`${kind}_conclusion`]: run?.conclusion ?? 'pending',
        [`${kind}_run_url`]: run?.html_url ?? '',
        [`${kind}_duration_ms`]: String(durationMs(run)),
      })
    }
  }
  await appendFile(required('GITHUB_OUTPUT'), `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, 'utf8')
}

function durationMs(run) {
  if (!run?.run_started_at || !run.updated_at) {
    return 0
  }
  const start = Date.parse(run.run_started_at)
  const end = Date.parse(run.updated_at)
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0
}

function headers(token) {
  return { 'accept': 'application/vnd.github+json', 'authorization': `Bearer ${token}`, 'x-github-api-version': '2022-11-28' }
}

async function githubRequest(apiUrl, token, pathname) {
  const response = await fetch(`${apiUrl}${pathname}`, { headers: headers(token), signal: AbortSignal.timeout(30_000) })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required.`)
  }
  return value
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
