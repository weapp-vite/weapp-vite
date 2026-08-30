/* eslint-disable style/max-statements-per-line */
import { appendFile } from 'node:fs/promises'
import process from 'node:process'

const token = required('GITHUB_TOKEN')
const repository = required('GITHUB_REPOSITORY')
const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
const event = JSON.parse(required('WORKFLOW_EVENT_JSON'))
const currentRun = event.workflow_run
const headSha = requiredValue(currentRun?.head_sha, 'workflow_run.head_sha')
const preferredPr = currentRun?.pull_requests?.[0]?.number

async function main() {
  const pullRequest = await resolvePullRequest(headSha, preferredPr)
  const runs = await listRuns(headSha)
  const performanceRun = latestRun(runs, 'CI Performance', currentRun)
  const runtimeRun = latestRun(runs, 'Wevu Runtime Size', currentRun)
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

async function resolvePullRequest(sha, preferredNumber) {
  const pulls = await githubRequest(`/repos/${repository}/commits/${sha}/pulls`)
  const matching = pulls.find(pull => pull.number === preferredNumber && pull.head?.sha === sha)
    ?? pulls.find(pull => pull.state === 'open' && pull.head?.sha === sha)
    ?? pulls.find(pull => pull.head?.sha === sha)
  if (!matching) { throw new Error(`No pull request found for ${sha}.`) }
  return matching
}

async function listRuns(sha) {
  const result = await githubRequest(`/repos/${repository}/actions/runs?event=pull_request&head_sha=${encodeURIComponent(sha)}&per_page=100`)
  return Array.isArray(result.workflow_runs) ? result.workflow_runs : []
}

function latestRun(runs, workflowName, current) {
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

async function githubRequest(pathname) {
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

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
