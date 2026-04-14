import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export interface MarketplaceReleasePlan {
  currentVersion: string
  marketplaceVersion: null | string
  previousVersion: null | string
  releaseTag: string
  shouldPublish: boolean
  tagExists: boolean
}

interface MarketplaceQueryResponse {
  results?: Array<{
    extensions?: Array<{
      versions?: Array<{
        version?: string
      }>
    }>
  }>
}

const extensionRoot = path.resolve(process.cwd())
const packageJsonPath = path.join(extensionRoot, 'package.json')
const releaseTagPrefix = 'vscode-extension-v'
const marketplaceApiUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'

/**
 * 执行 git 命令并返回标准输出。
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
 * 读取 package.json 对应的 Marketplace 扩展标识。
 */
function readMarketplaceIdentity(content: string) {
  const packageJson = JSON.parse(content)
  const publisher = packageJson.publisher
  const extensionName = packageJson['x-vsce']?.name ?? packageJson.name

  if (typeof publisher !== 'string' || publisher.length === 0) {
    throw new Error('package.json publisher is required')
  }

  if (typeof extensionName !== 'string' || extensionName.length === 0) {
    throw new Error('package.json extension name is required')
  }

  return {
    extensionName,
    publisher,
  }
}

/**
 * 从 package.json 文本中读取版本号。
 */
export function readVersionFromPackageJson(content: string) {
  const packageJson = JSON.parse(content)

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error('package.json version is required')
  }

  return packageJson.version
}

/**
 * 解析 semver 字符串。
 */
function parseSemver(version: string) {
  const matched = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?(?:\+.*)?$/i)

  if (!matched) {
    throw new Error(`invalid semver version: ${version}`)
  }

  return {
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
    prerelease: matched[4]?.split('.') ?? [],
  }
}

/**
 * 比较两个 semver 版本号。
 */
export function compareSemverVersions(left: string, right: string) {
  const leftVersion = parseSemver(left)
  const rightVersion = parseSemver(right)
  const mainKeys = ['major', 'minor', 'patch'] as const

  for (const key of mainKeys) {
    if (leftVersion[key] > rightVersion[key]) {
      return 1
    }

    if (leftVersion[key] < rightVersion[key]) {
      return -1
    }
  }

  const leftPrerelease = leftVersion.prerelease
  const rightPrerelease = rightVersion.prerelease

  if (leftPrerelease.length === 0 && rightPrerelease.length === 0) {
    return 0
  }

  if (leftPrerelease.length === 0) {
    return 1
  }

  if (rightPrerelease.length === 0) {
    return -1
  }

  const maxLength = Math.max(leftPrerelease.length, rightPrerelease.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftIdentifier = leftPrerelease[index]
    const rightIdentifier = rightPrerelease[index]

    if (leftIdentifier === undefined) {
      return -1
    }

    if (rightIdentifier === undefined) {
      return 1
    }

    if (leftIdentifier === rightIdentifier) {
      continue
    }

    const leftNumeric = /^\d+$/.test(leftIdentifier)
    const rightNumeric = /^\d+$/.test(rightIdentifier)

    if (leftNumeric && rightNumeric) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1
    }

    if (leftNumeric) {
      return -1
    }

    if (rightNumeric) {
      return 1
    }

    return leftIdentifier > rightIdentifier ? 1 : -1
  }

  return 0
}

/**
 * 从 Marketplace 查询结果里提取最新版本号。
 */
export function readMarketplaceLatestVersion(response: MarketplaceQueryResponse) {
  const versions = response.results
    ?.flatMap(result => result.extensions ?? [])
    .flatMap(extension => extension.versions ?? [])
    .map(version => version.version)
    .filter((version): version is string => typeof version === 'string' && version.length > 0)

  if (!versions || versions.length === 0) {
    return null
  }

  return versions.sort((left, right) => compareSemverVersions(right, left))[0]
}

/**
 * 读取 Marketplace 当前线上版本号。
 */
export async function fetchMarketplaceLatestVersion(publisher: string, extensionName: string) {
  const response = await fetch(marketplaceApiUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json;api-version=7.2-preview.1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: [
        {
          criteria: [
            {
              filterType: 7,
              value: `${publisher}.${extensionName}`,
            },
          ],
        },
      ],
      flags: 103,
    }),
  })

  if (!response.ok) {
    throw new Error(`failed to query VS Code Marketplace: ${response.status} ${response.statusText}`)
  }

  return readMarketplaceLatestVersion(await response.json())
}

/**
 * 根据线上版本与 tag 状态生成发布计划。
 */
export function createMarketplaceReleasePlan(
  currentVersion: string,
  previousVersion: null | string,
  marketplaceVersion: null | string,
  tagExists: boolean,
): MarketplaceReleasePlan {
  const releaseTag = `${releaseTagPrefix}${currentVersion}`
  const shouldPublish = marketplaceVersion === null
    ? !tagExists
    : compareSemverVersions(currentVersion, marketplaceVersion) > 0 && !tagExists

  return {
    currentVersion,
    marketplaceVersion,
    previousVersion,
    releaseTag,
    shouldPublish,
    tagExists,
  }
}

/**
 * 从 git 历史中读取上一个提交里的扩展版本号。
 */
function readPreviousVersion() {
  const previousPackageJson = runGit(['show', 'HEAD^:extensions/vscode/package.json'], true)

  if (!previousPackageJson) {
    return null
  }

  return readVersionFromPackageJson(previousPackageJson)
}

/**
 * 读取当前发布计划。
 */
async function loadMarketplaceReleasePlan() {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
  const currentVersion = readVersionFromPackageJson(packageJsonContent)
  const previousVersion = readPreviousVersion()
  const { extensionName, publisher } = readMarketplaceIdentity(packageJsonContent)
  const marketplaceVersion = await fetchMarketplaceLatestVersion(publisher, extensionName)
  const tagExists = runGit(['tag', '--list', `${releaseTagPrefix}${currentVersion}`], true).length > 0

  return createMarketplaceReleasePlan(currentVersion, previousVersion, marketplaceVersion, tagExists)
}

/**
 * 将发布计划写入 GitHub Actions 输出变量。
 */
function writeGitHubOutput(plan: MarketplaceReleasePlan) {
  const githubOutput = process.env.GITHUB_OUTPUT

  if (!githubOutput) {
    return
  }

  const lines = [
    `current_version=${plan.currentVersion}`,
    `marketplace_version=${plan.marketplaceVersion ?? ''}`,
    `previous_version=${plan.previousVersion ?? ''}`,
    `release_tag=${plan.releaseTag}`,
    `should_publish=${String(plan.shouldPublish)}`,
    `tag_exists=${String(plan.tagExists)}`,
  ]

  fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`)
}

async function main() {
  const plan = await loadMarketplaceReleasePlan()

  writeGitHubOutput(plan)
  console.log(JSON.stringify(plan, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
