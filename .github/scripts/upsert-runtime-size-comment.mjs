import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const COMMENT_MARKER = '<!-- wevu-runtime-size-report -->'

const TARGETS = [
  { id: 'weapp', label: '微信小程序', gzip: false },
  { id: 'web', label: 'Web', gzip: true },
]

const TIERS = [
  { id: 'reactivity-core', label: '响应式核心', description: '`ref`' },
  { id: 'minimal-app', label: '最小应用', description: '响应式核心 + `createApp`、`setWevuDefaults`' },
  { id: 'typical-page', label: '典型页面', description: '最小应用 + 组件注册、常用响应式、页面生命周期、class/style 模板辅助' },
  { id: 'complex-component', label: '复杂组件', description: '典型页面 + provide/inject、slots、template ref、model、动态 layout' },
  { id: 'full-provider', label: '完整 Provider', description: '端侧 runtime provider 暴露的全部能力上限' },
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
  if (report.version !== 2) {
    throw new Error(`${label}.version must be 2.`)
  }
  assertCommit(report.commit, `${label}.commit`)
  if (!Array.isArray(report.targets) || report.targets.length !== TARGETS.length) {
    throw new Error(`${label}.targets must contain the configured runtime targets.`)
  }

  for (const [targetIndex, expected] of TARGETS.entries()) {
    const target = report.targets[targetIndex]
    if (target?.id !== expected.id) {
      throw new Error(`${label}.targets[${targetIndex}] must be ${expected.id}.`)
    }
    if (!Array.isArray(target.tiers) || target.tiers.length !== TIERS.length) {
      throw new Error(`${label}.${expected.id}.tiers must contain the configured runtime tiers.`)
    }
    for (const [tierIndex, expectedTier] of TIERS.entries()) {
      const tier = target.tiers[tierIndex]
      if (tier?.id !== expectedTier.id) {
        throw new Error(`${label}.${expected.id}.tiers[${tierIndex}] must be ${expectedTier.id}.`)
      }
      assertBytes(tier.dev?.bytes, `${label}.${expected.id}.${expectedTier.id}.dev.bytes`)
      assertBytes(tier.production?.bytes, `${label}.${expected.id}.${expectedTier.id}.production.bytes`)
      if (tier.dev?.gzipBytes !== undefined) {
        throw new Error(`${label}.${expected.id}.${expectedTier.id}.dev must not contain gzipBytes.`)
      }
      if (expected.gzip) {
        assertBytes(tier.production?.gzipBytes, `${label}.${expected.id}.${expectedTier.id}.production.gzipBytes`)
      }
      else if (tier.production?.gzipBytes !== undefined) {
        throw new Error(`${label}.${expected.id}.${expectedTier.id} must not contain gzipBytes.`)
      }
    }
  }
  return report
}

export function validateArtifact(value, expected) {
  const artifact = assertObject(value, 'artifact')
  if (artifact.version !== 2 || artifact.kind !== 'wevu-runtime-size-pr-report') {
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
    '### 完整 Provider 能力上限',
    '',
    '| 端 | Dev 未压缩 | Production 压缩 | Production gzip |',
    '| --- | ---: | ---: | ---: |',
  ]
  for (const target of TARGETS) {
    const current = currentById.get(target.id)
    const baseline = baselineById.get(target.id)
    const currentTier = current.tiers.at(-1)
    const baselineTier = baseline.tiers.at(-1)
    lines.push(`| ${target.label} | ${formatMeasurement(currentTier.dev.bytes, baselineTier.dev.bytes)} | ${formatMeasurement(currentTier.production.bytes, baselineTier.production.bytes)} | ${target.gzip ? formatMeasurement(currentTier.production.gzipBytes, baselineTier.production.gzipBytes) : '不适用'} |`)
  }
  lines.push('', '### 正常 Tree-shaking 阶梯')
  for (const target of TARGETS) {
    const current = currentById.get(target.id)
    const baseline = baselineById.get(target.id)
    lines.push(
      '',
      `#### ${target.label}`,
      '',
      '| 阶梯 | Dev 未压缩 | Production 压缩 | Production gzip |',
      '| --- | ---: | ---: | ---: |',
    )
    for (const [tierIndex, tier] of TIERS.entries()) {
      const currentTier = current.tiers[tierIndex]
      const baselineTier = baseline.tiers[tierIndex]
      lines.push(`| ${tier.label} | ${formatMeasurement(currentTier.dev.bytes, baselineTier.dev.bytes)} | ${formatMeasurement(currentTier.production.bytes, baselineTier.production.bytes)} | ${target.gzip ? formatMeasurement(currentTier.production.gzipBytes, baselineTier.production.gzipBytes) : '不适用'} |`)
    }
  }
  lines.push(
    '',
    ...TIERS.map(tier => `- **${tier.label}**：${tier.description}`),
    '',
    `- 当前 commit：\`${artifact.current.commit}\``,
    `- 对比基线：\`${artifact.baseline.commit}\``,
    '- 阶梯使用具名导入模拟正常 tree-shaking；完整 Provider 行表示全部能力上限。',
    '- Web 最小应用包含 app 注册桥；典型页面及以上同时包含组件/页面注册桥。',
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
