import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const COMMENT_MARKER = '<!-- wevu-runtime-size-report -->'

const TARGETS = [
  { id: 'weapp', label: '微信小程序', gzip: false },
  { id: 'web', label: 'Web', gzip: true },
]

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value
}

function assertCommit(value, label) {
  const commit = assertString(value, label)
  if (!/^[\da-f]{7,64}$/i.test(commit)) {
    throw new Error(`${label} must be a hexadecimal Git commit.`)
  }
  return commit
}

function assertBytes(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`)
  }
  return value
}

function validateReport(value, label) {
  const report = assertObject(value, label)
  if (report.version !== 1) {
    throw new Error(`${label}.version must be 1.`)
  }
  assertCommit(report.commit, `${label}.commit`)
  if (!Array.isArray(report.targets) || report.targets.length !== TARGETS.length) {
    throw new Error(`${label}.targets must contain the configured runtime targets.`)
  }

  for (const expected of TARGETS) {
    const target = report.targets.find(candidate => candidate?.id === expected.id)
    if (!target) {
      throw new Error(`${label}.targets is missing ${expected.id}.`)
    }
    assertBytes(target.dev?.bytes, `${label}.${expected.id}.dev.bytes`)
    assertBytes(target.production?.bytes, `${label}.${expected.id}.production.bytes`)
    if (expected.gzip) {
      assertBytes(target.production?.gzipBytes, `${label}.${expected.id}.production.gzipBytes`)
    }
    else if (target.production?.gzipBytes !== undefined) {
      throw new Error(`${label}.${expected.id} must not contain gzipBytes.`)
    }
  }
  return report
}

export function validateArtifact(value, expected) {
  const artifact = assertObject(value, 'artifact')
  if (artifact.version !== 1 || artifact.kind !== 'wevu-runtime-size-pr-report') {
    throw new Error('Unsupported runtime size artifact.')
  }
  if (artifact.repository !== expected.repository) {
    throw new Error('Artifact repository does not match the workflow repository.')
  }
  if (artifact.prNumber !== expected.prNumber) {
    throw new Error('Artifact PR number does not match the workflow PR.')
  }
  if (artifact.headSha !== expected.headSha) {
    throw new Error('Artifact head SHA does not match the workflow run.')
  }
  assertCommit(artifact.headSha, 'artifact.headSha')
  assertCommit(artifact.baseSha, 'artifact.baseSha')
  return {
    ...artifact,
    current: validateReport(artifact.current, 'artifact.current'),
    baseline: validateReport(artifact.baseline, 'artifact.baseline'),
  }
}

export function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : ''
  const absolute = Math.abs(bytes)
  if (absolute < 1024) {
    return `${sign}${absolute} B`
  }
  const units = ['KiB', 'MiB', 'GiB']
  let value = absolute
  let unitIndex = -1
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${sign}${value.toFixed(2)} ${units[unitIndex]}`
}

function formatMeasurement(current, baseline) {
  const delta = current - baseline
  const deltaSign = delta > 0 ? '+' : ''
  const percent = baseline === 0 ? undefined : delta / baseline * 100
  const percentText = percent === undefined ? 'n/a' : `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`
  return `${formatBytes(current)} (${deltaSign}${formatBytes(delta)}, ${percentText})`
}

export function renderSuccessComment(artifact) {
  const currentById = new Map(artifact.current.targets.map(target => [target.id, target]))
  const baselineById = new Map(artifact.baseline.targets.map(target => [target.id, target]))
  const lines = [
    COMMENT_MARKER,
    '## wevu 运行时体积',
    '',
    '| 端 | Dev 未压缩 | Production 压缩 | Production gzip |',
    '| --- | ---: | ---: | ---: |',
  ]
  for (const target of TARGETS) {
    const current = currentById.get(target.id)
    const baseline = baselineById.get(target.id)
    lines.push(`| ${target.label} | ${formatMeasurement(current.dev.bytes, baseline.dev.bytes)} | ${formatMeasurement(current.production.bytes, baseline.production.bytes)} | ${target.gzip ? formatMeasurement(current.production.gzipBytes, baseline.production.gzipBytes) : '不适用'} |`)
  }
  lines.push(
    '',
    `- 当前 commit：\`${artifact.current.commit}\``,
    `- 对比基线：\`${artifact.baseline.commit}\``,
    '- 统计完整 runtime provider 的能力上限，不等同于业务应用 tree-shaking 后的起步体积。',
    '- 小程序仅统计产物字节；Web gzip 使用 level 9。',
  )
  return lines.join('\n')
}

export function renderFailureComment(runUrl, detail) {
  return [
    COMMENT_MARKER,
    '## wevu 运行时体积',
    '',
    `本次统计失败：${detail}`,
    '',
    `[查看 GitHub Actions 运行记录](${runUrl})`,
  ].join('\n')
}

export function findExistingComment(comments) {
  return comments.find(comment => comment.user?.type === 'Bot' && comment.body?.includes(COMMENT_MARKER))
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
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${await response.text()}`)
  }
  return response.status === 204 ? undefined : response.json()
}

async function resolvePullRequest({ apiUrl, token, repository, headSha, preferredNumber }) {
  const pulls = await githubRequest(apiUrl, token, `/repos/${repository}/commits/${headSha}/pulls`)
  const matching = pulls.find(pull => pull.head?.sha === headSha && pull.number === preferredNumber)
    ?? pulls.find(pull => pull.head?.sha === headSha && pull.state === 'open')
    ?? pulls.find(pull => pull.head?.sha === headSha)
  if (!matching) {
    throw new Error(`No pull request is associated with ${headSha}.`)
  }
  return matching
}

async function listComments({ apiUrl, token, repository, prNumber, request = githubRequest }) {
  const comments = []
  for (let page = 1; ; page += 1) {
    const result = await request(apiUrl, token, `/repos/${repository}/issues/${prNumber}/comments?per_page=100&page=${page}`)
    comments.push(...result)
    if (result.length < 100) {
      return comments
    }
  }
}

export async function upsertComment({ apiUrl, token, repository, prNumber, body, request = githubRequest }) {
  const comments = await listComments({ apiUrl, token, repository, prNumber, request })
  const existing = findExistingComment(comments)
  const requestBody = JSON.stringify({ body })
  if (existing) {
    await request(apiUrl, token, `/repos/${repository}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      body: requestBody,
    })
    return
  }
  await request(apiUrl, token, `/repos/${repository}/issues/${prNumber}/comments`, {
    method: 'POST',
    body: requestBody,
  })
}

async function main() {
  const token = assertString(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN')
  const repository = assertString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY')
  const headSha = assertString(process.env.WORKFLOW_HEAD_SHA, 'WORKFLOW_HEAD_SHA')
  const conclusion = assertString(process.env.WORKFLOW_CONCLUSION, 'WORKFLOW_CONCLUSION')
  const runUrl = assertString(process.env.WORKFLOW_RUN_URL, 'WORKFLOW_RUN_URL')
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const preferredNumber = Number.parseInt(process.env.WORKFLOW_PR_NUMBER ?? '', 10)
  const pullRequest = await resolvePullRequest({
    apiUrl,
    token,
    repository,
    headSha,
    preferredNumber: Number.isSafeInteger(preferredNumber) ? preferredNumber : undefined,
  })

  let body
  if (conclusion !== 'success') {
    body = renderFailureComment(runUrl, `workflow 状态为 \`${conclusion}\`。`)
  }
  else {
    try {
      const artifactPath = assertString(process.env.RUNTIME_SIZE_ARTIFACT, 'RUNTIME_SIZE_ARTIFACT')
      const artifact = validateArtifact(
        JSON.parse(await readFile(artifactPath, 'utf8')),
        { repository, prNumber: pullRequest.number, headSha },
      )
      body = renderSuccessComment(artifact)
    }
    catch (error) {
      body = renderFailureComment(runUrl, `报告 artifact 无效：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  await upsertComment({ apiUrl, token, repository, prNumber: pullRequest.number, body })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
