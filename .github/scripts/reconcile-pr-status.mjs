import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { validatePrContext } from './pr-context.mjs'
import { createPrStatusClient } from './pr-status-client.mjs'
import { publishPrStatus, trustedRun } from './publish-pr-status.mjs'

/** 按 PR 同步每个 workflow 最近一次的实际运行，不重新调度构建或测试。 */
export async function reconcilePrStatuses({ repository, defaultBranch, prNumber, request, readContext, verifyContext, publish = publishPrStatus, serverUrl, maxPages = 10 }) {
  if (!/^[1-9]\d*$/u.test(String(prNumber)) || !Number.isSafeInteger(Number(prNumber))) {
    throw new Error('pr-number must be a positive PR number')
  }
  const pull = await request(`/repos/${repository}/pulls/${prNumber}`)
  if (pull.state !== 'open' || pull.base?.repo?.full_name !== repository || !pull.head?.repo?.full_name) {
    throw new Error('PR must be open and target this repository')
  }
  const selected = new Set()
  const results = []
  let inspected = 0
  for (let page = 1; page <= maxPages; page++) {
    const since = pull.created_at ? `&created=${encodeURIComponent(`>=${pull.created_at}`)}` : ''
    const response = await request(`/repos/${repository}/actions/runs?event=workflow_dispatch&per_page=100&page=${page}${since}`)
    if (!Array.isArray(response.workflow_runs)) {
      throw new TypeError('Invalid manual workflow run response')
    }
    const runs = response.workflow_runs.toSorted((a, b) => Number(BigInt(b.id) - BigInt(a.id)))
    for (const run of runs) {
      if (!trustedRun(run, repository, defaultBranch) || selected.has(run.name)) {
        continue
      }
      inspected++
      try {
        const context = await readContext(run)
        if (!context.isPr || context.prNumber !== Number(prNumber) || context.headSha !== pull.head.sha
          || context.headRepository !== pull.head.repo.full_name || context.baseRef !== pull.base.ref) {
          continue
        }
        validatePrContext(context, run, repository)
        const result = await publish({ repository, defaultBranch, run, context, request, verifyContext, serverUrl })
        results.push({ runId: String(run.id), workflow: run.name, ...result })
        if (result.published || ['already-final', 'newer-run', 'unchanged'].includes(result.reason)) {
          selected.add(run.name)
        }
      }
      catch (error) {
        if (['PR_CONTEXT_MISSING', 'PR_CONTEXT_UNTRUSTED'].includes(error.code)) {
          continue
        }
        throw error
      }
    }
    if (runs.length < 100) {
      return { prNumber: Number(prNumber), inspected, truncated: false, results }
    }
  }
  return { prNumber: Number(prNumber), inspected, truncated: true, results }
}

async function main() {
  const token = process.env.GITHUB_TOKEN?.trim()
  const repository = process.env.GITHUB_REPOSITORY?.trim()
  if (!token || !repository) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required')
  }
  if (process.env.PR_STATUS_RUN_ID?.trim()) {
    throw new Error('Select either run-id or pr-number, not both')
  }
  const client = createPrStatusClient({ token, repository, apiUrl: process.env.GITHUB_API_URL })
  const repo = await client.request(`/repos/${repository}`)
  const result = await reconcilePrStatuses({ ...client, repository, defaultBranch: repo.default_branch, prNumber: process.env.PR_STATUS_PR_NUMBER?.trim(), serverUrl: process.env.GITHUB_SERVER_URL })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
