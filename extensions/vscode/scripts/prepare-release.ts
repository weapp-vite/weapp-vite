import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export type ReleaseType = 'major' | 'minor' | 'patch'

export interface CommitInfo {
  body: string
  subject: string
}

export interface ReleasePlan {
  changedFiles: string[]
  currentVersion: string
  lastTag: null | string
  nextVersion: null | string
  notes: string[]
  range: string
  releaseTag: null | string
  releaseType: null | ReleaseType
  shouldRelease: boolean
}

const extensionRoot = path.resolve(process.cwd())
const packageJsonPath = path.join(extensionRoot, 'package.json')
const changelogPath = path.join(extensionRoot, 'CHANGELOG.md')
const releaseTagPrefix = 'vscode-extension-v'
const releasePlaceholder = '- Nothing yet.'
const breakingChangeBodyRE = /(?:^|\n)BREAKING CHANGE:/m
const breakingChangeSubjectRE = /^[a-z]+(?:\([^)]+\))?!:/
const featureCommitSubjectRE = /^feat(?:\([^)]+\))?:/
const changelogTitleRE = /^# Changelog\s*/i

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

/**
 * 运行 git 命令并返回标准输出。
 */
function runGit(args: string[], allowFailure = false) {
  const result = spawnSync('git', args, {
    cwd: extensionRoot,
    encoding: 'utf8',
    shell: false,
  })

  if (result.status !== 0) {
    if (allowFailure) {
      return ''
    }

    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
  }

  return result.stdout.trim()
}

/**
 * 判断文件是否会影响扩展实际发布产物。
 */
export function isReleaseWorthyFile(filePath: string) {
  return [
    'extensions/vscode/assets/',
    'extensions/vscode/extension/',
    'extensions/vscode/snippets/',
    'extensions/vscode/syntaxes/',
    'extensions/vscode/types/',
  ].some(prefix => filePath.startsWith(prefix))
  || [
    'extensions/vscode/extension.ts',
    'extensions/vscode/package.json',
    'extensions/vscode/tsconfig.json',
    'extensions/vscode/tsdown.config.mts',
  ].includes(filePath)
}

/**
 * 解析 git log 输出为提交列表。
 */
export function parseCommitLog(rawLog: string): CommitInfo[] {
  return rawLog
    .split('\u001E')
    .map(block => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [subject = '', ...bodyLines] = block.split('\n')

      return {
        subject: subject.trim(),
        body: bodyLines.join('\n').trim(),
      }
    })
}

/**
 * 根据 Conventional Commit 语义推导发布级别。
 */
export function detectReleaseType(commits: CommitInfo[]): null | ReleaseType {
  if (commits.length === 0) {
    return null
  }

  const hasBreaking = commits.some(({ body, subject }) =>
    breakingChangeBodyRE.test(body) || breakingChangeSubjectRE.test(subject),
  )

  if (hasBreaking) {
    return 'major'
  }

  const hasFeature = commits.some(({ subject }) => featureCommitSubjectRE.test(subject))

  if (hasFeature) {
    return 'minor'
  }

  return 'patch'
}

/**
 * 计算下一个语义化版本号。
 */
export function bumpVersion(version: string, releaseType: ReleaseType) {
  const [majorText = '0', minorText = '0', patchText = '0'] = version.split('.')
  const major = Number(majorText)
  const minor = Number(minorText)
  const patch = Number(patchText)

  if ([major, minor, patch].some(value => Number.isNaN(value))) {
    throw new Error(`invalid version: ${version}`)
  }

  if (releaseType === 'major') {
    return `${major + 1}.0.0`
  }

  if (releaseType === 'minor') {
    return `${major}.${minor + 1}.0`
  }

  return `${major}.${minor}.${patch + 1}`
}

/**
 * 从 changelog 中读取未发布条目。
 */
export function readUnreleasedNotes(changelog: string) {
  const heading = '## Unreleased'
  const start = changelog.indexOf(heading)

  if (start === -1) {
    return []
  }

  const bodyStart = changelog.indexOf('\n', start) + 1
  const nextHeading = changelog.indexOf('\n## ', bodyStart)
  const body = (nextHeading === -1 ? changelog.slice(bodyStart) : changelog.slice(bodyStart, nextHeading)).trim()

  return body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .filter(line => line !== releasePlaceholder)
}

/**
 * 生成新的 changelog 文本。
 */
export function renderChangelog(changelog: string, version: string, notes: string[], date: string) {
  const releaseBody = notes.join('\n')
  const releaseSection = `## ${version} - ${date}\n\n${releaseBody}`
  const heading = '## Unreleased'
  const start = changelog.indexOf(heading)

  if (start !== -1) {
    const bodyStart = changelog.indexOf('\n', start) + 1
    const nextHeading = changelog.indexOf('\n## ', bodyStart)
    const before = changelog.slice(0, start)
    const after = nextHeading === -1 ? '' : changelog.slice(nextHeading + 1)

    return `${`${before}## Unreleased\n\n${releasePlaceholder}\n\n${releaseSection}\n\n${after}`.trimEnd()}\n`
  }

  return `# Changelog\n\n## Unreleased\n\n${releasePlaceholder}\n\n${releaseSection}\n\n${changelog.replace(changelogTitleRE, '').trim()}\n`
}

/**
 * 基于提交标题兜底生成发布说明。
 */
export function fallbackReleaseNotes(commits: CommitInfo[]) {
  return commits.map(({ subject }) => `- ${subject}`)
}

/**
 * 解析本次发布的 git 变更范围。
 */
function resolveRange() {
  const baseRef = process.env.WEAPP_VSCODE_RELEASE_BASE?.trim()

  if (baseRef && baseRef !== '0000000000000000000000000000000000000000') {
    return {
      lastTag: null,
      range: `${baseRef}..HEAD`,
    }
  }

  const lastTag = runGit(['tag', '--list', `${releaseTagPrefix}*`, '--sort=-v:refname'], true)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)[0] ?? null

  if (lastTag) {
    return {
      lastTag,
      range: `${lastTag}..HEAD`,
    }
  }

  const previousCommit = runGit(['rev-parse', 'HEAD^'], true)

  if (previousCommit) {
    return {
      lastTag: null,
      range: `${previousCommit}..HEAD`,
    }
  }

  return {
    lastTag: null,
    range: 'HEAD',
  }
}

/**
 * 生成本次发布计划。
 */
export function createReleasePlan(changelog: string, commits: CommitInfo[], changedFiles: string[], currentVersion: string, range: string, lastTag: null | string): ReleasePlan {
  const effectiveFiles = changedFiles.filter(isReleaseWorthyFile)

  if (effectiveFiles.length === 0) {
    return {
      changedFiles,
      currentVersion,
      lastTag,
      nextVersion: null,
      notes: [],
      range,
      releaseTag: null,
      releaseType: null,
      shouldRelease: false,
    }
  }

  const releaseType = detectReleaseType(commits) ?? 'patch'
  const nextVersion = bumpVersion(currentVersion, releaseType)
  const notes = readUnreleasedNotes(changelog)
  const releaseNotes = notes.length > 0 ? notes : fallbackReleaseNotes(commits)

  return {
    changedFiles,
    currentVersion,
    lastTag,
    nextVersion,
    notes: releaseNotes,
    range,
    releaseTag: `${releaseTagPrefix}${nextVersion}`,
    releaseType,
    shouldRelease: releaseNotes.length > 0,
  }
}

/**
 * 从仓库状态读取完整发布计划。
 */
function loadReleasePlan() {
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  const { lastTag, range } = resolveRange()
  const changedOutput = runGit(['diff', '--name-only', range, '--', 'extensions/vscode'], true)
  const changedFiles = changedOutput
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const commitLog = runGit(['log', '--format=%s%n%b%x1E', range, '--', 'extensions/vscode'], true)
  const commits = parseCommitLog(commitLog)

  return createReleasePlan(changelog, commits, changedFiles, packageJson.version, range, lastTag)
}

/**
 * 将计划写入 GitHub Actions 输出。
 */
function writeGitHubOutput(plan: ReleasePlan) {
  const githubOutput = process.env.GITHUB_OUTPUT

  if (!githubOutput) {
    return
  }

  const lines = [
    `should_release=${String(plan.shouldRelease)}`,
    `current_version=${plan.currentVersion}`,
    `next_version=${plan.nextVersion ?? ''}`,
    `release_type=${plan.releaseType ?? ''}`,
    `release_tag=${plan.releaseTag ?? ''}`,
    `range=${plan.range}`,
  ]

  fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`)
}

/**
 * 应用版本与 changelog 更新。
 */
function applyReleasePlan(plan: ReleasePlan) {
  if (!plan.shouldRelease || !plan.nextVersion) {
    console.log('no releasable vscode extension changes detected')
    return
  }

  const nextPackageJson = {
    ...packageJson,
    version: plan.nextVersion,
  }
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  const today = new Date().toISOString().slice(0, 10)

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`)
  fs.writeFileSync(changelogPath, renderChangelog(changelog, plan.nextVersion, plan.notes, today))

  console.log(`prepared vscode extension release ${plan.nextVersion}`)
}

function main() {
  const mode = process.argv[2] ?? 'plan'
  const plan = loadReleasePlan()

  writeGitHubOutput(plan)

  if (mode === 'plan') {
    console.log(JSON.stringify(plan, null, 2))
    process.exit(0)
  }

  if (mode === 'apply') {
    applyReleasePlan(plan)
    process.exit(0)
  }

  throw new Error(`unknown release mode: ${mode}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
