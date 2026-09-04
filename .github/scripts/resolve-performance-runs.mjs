/* eslint-disable style/max-statements-per-line */
import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

async function main() {
  const token = required('GITHUB_TOKEN')
  const repository = required('GITHUB_REPOSITORY')
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const event = JSON.parse(required('WORKFLOW_EVENT_JSON'))
  const currentRun = event.workflow_run
  const headSha = requiredValue(currentRun?.head_sha, 'workflow_run.head_sha')
  const pullRequest = await resolvePullRequest({
    apiUrl,
    headBranch: currentRun?.head_branch,
    headRepository: currentRun?.head_repository?.full_name,
    headSha,
    preferredNumber: currentRun?.pull_requests?.[0]?.number,
    repository,
    token,
  })
  const runs = await listRuns({ apiUrl, headSha, repository, token })
  const performanceRun = latestRun(runs, 'CI Performance', currentRun, headSha)
  const runtimeRun = latestRun(runs, 'Wevu Runtime Size', currentRun, headSha)
  const outputs = {
    pr_number: String(pullRequest.number),
    head_sha: headSha,
    base_sha: pullRequest.base?.sha ?? '',
    performance_run_id: performanceRun ? String(performanceRun.id) : '',
    performance_conclusion: performanceRun?.conclusion ?? 'pending',
    performance_run_url: performanceRun?.html_url ?? '',
    performance_duration_ms: String(durationMs(performanceRun)),
    runtime_run_id: runtimeRun ? String(runtimeRun.id) : '',
    runtime_conclusion: runtimeRun?.conclusion ?? 'pending',
    runtime_run_url: runtimeRun?.html_url ?? '',
    runtime_duration_ms: String(durationMs(runtimeRun)),
  }
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) { throw new Error('GITHUB_OUTPUT is required.') }
  await appendFile(outputPath, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, 'utf8')
}

export async function resolvePullRequest({ apiUrl, headBranch, headRepository, headSha, preferredNumber, repository, token, request = githubRequest }) {
  if (headRepository && headBranch) {
    const [headOwner] = headRepository.split('/', 1)
    const head = `${headOwner}:${headBranch}`
    const pulls = await request(apiUrl, token, `/repos/${repository}/pulls?state=all&head=${encodeURIComponent(head)}&per_page=100`)
    const matching = findMatchingPullRequest(pulls, headSha, preferredNumber)
    if (matching) { return matching }
  }

  const pulls = await request(apiUrl, token, `/repos/${repository}/commits/${headSha}/pulls`)
  const matching = findMatchingPullRequest(pulls, headSha, preferredNumber)
  if (!matching) { throw new Error(`No pull request found for ${headSha}.`) }
  return matching
}

async function listRuns({ apiUrl, headSha, repository, token }) {
  const result = await githubRequest(apiUrl, token, `/repos/${repository}/actions/runs?event=pull_request&head_sha=${encodeURIComponent(headSha)}&per_page=100`)
  return Array.isArray(result.workflow_runs) ? result.workflow_runs : []
}

function findMatchingPullRequest(pulls, headSha, preferredNumber) {
  return pulls.find(pull => pull.number === preferredNumber && pull.head?.sha === headSha)
    ?? pulls.find(pull => pull.state === 'open' && pull.head?.sha === headSha)
    ?? pulls.find(pull => pull.head?.sha === headSha)
}

function latestRun(runs, workflowName, current, headSha) {
  const candidates = runs.filter(run => run.name === workflowName && run.head_sha === headSha && run.status === 'completed')
  if (current?.name === workflowName && current.head_sha === headSha && current.status === 'completed') { candidates.push(current) }
  return candidates.sort((a, b) => Date.parse(b.updated_at ?? b.created_at ?? '') - Date.parse(a.updated_at ?? a.created_at ?? ''))[0]
}

function durationMs(run) {
  if (!run?.run_started_at || !run.updated_at) { return 0 }
  const start = Date.parse(run.run_started_at)
  const end = Date.parse(run.updated_at)
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0
}

async function githubRequest(apiUrl, token, pathname) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    headers: {
      'accept': 'application/vnd.github+json',
      'authorization': `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  })
  if (!response.ok) { throw new Error(`GitHub API ${response.status}: ${await response.text()}`) }
  return response.json()
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) { throw new Error(`${name} is required.`) }
  return value
}

function requiredValue(value, name) {
  if (typeof value !== 'string' || !value) { throw new Error(`${name} is required.`) }
  return value
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
