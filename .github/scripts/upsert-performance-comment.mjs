/* eslint-disable style/max-statements-per-line */
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  collectPerformanceReports,
  COMMENT_MARKER,
  renderPerformanceComment,
} from './performance-comment-report.mjs'

async function main() {
  const token = required('GITHUB_TOKEN')
  const repository = required('GITHUB_REPOSITORY')
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const prNumber = Number.parseInt(required('PR_NUMBER'), 10)
  const headSha = required('HEAD_SHA')
  const baseSha = required('BASE_SHA')
  const performanceRunId = optionalNumber('PERFORMANCE_RUN_ID')
  const runtimeRunId = optionalNumber('RUNTIME_RUN_ID')
  const data = await collectPerformanceReports({
    performanceRoot: process.env.PERFORMANCE_ARTIFACT_ROOT,
    runtimeRoot: process.env.RUNTIME_ARTIFACT_ROOT,
    runtimeExpected: { repository, prNumber, headSha },
  })
  const runs = [
    createRun('CI Performance', performanceRunId, process.env.PERFORMANCE_RUN_URL, process.env.PERFORMANCE_CONCLUSION, process.env.PERFORMANCE_DURATION_MS),
    createRun('Wevu Runtime Size', runtimeRunId, process.env.RUNTIME_RUN_URL, process.env.RUNTIME_CONCLUSION, process.env.RUNTIME_DURATION_MS),
  ].filter(Boolean)
  const artifacts = await listArtifactLinks({ apiUrl, token, repository, runIds: [performanceRunId, runtimeRunId].filter(Boolean) })
  let body = renderPerformanceComment({
    data,
    metadata: {
      prNumber,
      headSha,
      baseSha,
      generatedAt: new Date().toISOString(),
      os: process.env.RUNNER_OS,
      node: process.version,
      pnpm: process.env.PNPM_VERSION,
    },
    runs,
    artifacts,
    conclusions: {
      performanceConclusion: process.env.PERFORMANCE_CONCLUSION ?? 'pending',
      runtimeConclusion: process.env.RUNTIME_CONCLUSION ?? 'pending',
    },
  })
  body = limitBody(body)
  await upsertComment({ apiUrl, token, repository, prNumber, body })
}

function createRun(name, id, url, conclusion, duration) {
  if (!id && !url) { return undefined }
  return { name, id, url: url || '#', conclusion, durationMs: Number(duration) || undefined }
}

async function listArtifactLinks({ apiUrl, token, repository, runIds }) {
  const artifacts = []
  for (const runId of runIds) {
    const result = await githubRequest(apiUrl, token, `/repos/${repository}/actions/runs/${runId}/artifacts`)
    for (const artifact of Array.isArray(result.artifacts) ? result.artifacts : []) {
      if (artifact.expired) { continue }
      artifacts.push({
        name: artifact.name,
        url: artifact.html_url ?? `https://github.com/${repository}/actions/runs/${runId}/artifacts/${artifact.id}`,
      })
    }
  }
  return artifacts.filter(artifact => artifact.name && artifact.url)
}

async function upsertComment({ apiUrl, token, repository, prNumber, body }) {
  const comments = await githubRequest(apiUrl, token, `/repos/${repository}/issues/${prNumber}/comments?per_page=100`)
  const existing = (Array.isArray(comments) ? comments : []).find(comment => comment.user?.type === 'Bot' && (
    comment.body?.includes(COMMENT_MARKER)
    || comment.body?.includes('<!-- wevu-runtime-size-report -->')
  ))
  const options = { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ body }) }
  const path = existing
    ? `/repos/${repository}/issues/comments/${existing.id}`
    : `/repos/${repository}/issues/${prNumber}/comments`
  await githubRequest(apiUrl, token, path, options)
}

async function githubRequest(apiUrl, token, pathname, options = {}) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    ...options,
    headers: {
      'accept': 'application/vnd.github+json',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      ...options.headers,
    },
  })
  if (!response.ok) { throw new Error(`GitHub API ${response.status}: ${await response.text()}`) }
  return response.status === 204 ? undefined : response.json()
}

function limitBody(body) {
  const limit = 60_000
  return body.length <= limit ? body : `${body.slice(0, limit - 180)}\n\n> 报告内容过长，完整明细请查看 Actions artifact。`
}

function optionalNumber(name) {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) { throw new Error(`${name} is required.`) }
  return value
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

export { limitBody, upsertComment }
