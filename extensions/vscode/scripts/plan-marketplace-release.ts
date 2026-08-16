import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

export interface MarketplaceReleasePlan {
  currentVersion: string
  currentRef: null | string
  isMainRef: boolean
  marketplaceVersion: null | string
  releaseTag: string
  shouldPublish: boolean
  shouldTag: boolean
  tagExists: boolean
}

interface MarketplacePackageJson {
  'name'?: unknown
  'publisher'?: unknown
  'version'?: unknown
  'x-vsce'?: {
    name?: unknown
  }
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
const mainBranchRef = 'refs/heads/main'
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
  const packageJson = JSON.parse(content) as MarketplacePackageJson
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
  const packageJson = JSON.parse(content) as MarketplacePackageJson

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
 * 判断当前 ref 是否为主分支发布 ref。
 */
export function isMainReleaseRef(ref: null | string | undefined) {
  return ref === mainBranchRef
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
 * 根据线上版本与远端 tag 状态生成发布计划。
 */
export function createMarketplaceReleasePlan(
  currentVersion: string,
  marketplaceVersion: null | string,
  tagExists: boolean,
  currentRef: null | string,
): MarketplaceReleasePlan {
  const releaseTag = `${releaseTagPrefix}${currentVersion}`
  const isMainRef = isMainReleaseRef(currentRef)

  if (!isMainRef) {
    return {
      currentVersion,
      currentRef,
      isMainRef,
      marketplaceVersion,
      releaseTag,
      shouldPublish: false,
      shouldTag: false,
      tagExists,
    }
  }

  if (marketplaceVersion !== null && compareSemverVersions(marketplaceVersion, currentVersion) > 0) {
    throw new Error(`VS Code Marketplace version ${marketplaceVersion} is ahead of repository version ${currentVersion}`)
  }

  return {
    currentVersion,
    currentRef,
    isMainRef,
    marketplaceVersion,
    releaseTag,
    shouldPublish: marketplaceVersion === null || compareSemverVersions(currentVersion, marketplaceVersion) > 0,
    shouldTag: !tagExists,
    tagExists,
  }
}

/**
 * 读取 Marketplace 当前线上版本号。
 */
async function fetchMarketplaceLatestVersion(publisher: string, extensionName: string) {
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

  return readMarketplaceLatestVersion(await response.json() as MarketplaceQueryResponse)
}

/**
 * 解析当前 release 运行所在的 git ref。
 */
function resolveCurrentReleaseRef() {
  const githubRef = process.env.GITHUB_REF?.trim()

  if (githubRef) {
    return githubRef
  }

  const branchName = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], true)
  if (!branchName || branchName === 'HEAD') {
    return null
  }

  return `refs/heads/${branchName}`
}

/**
 * 判断远端 tag 是否存在；网络或权限错误不会被当成 tag 缺失。
 */
function remoteTagExists(tag: string) {
  const result = spawnSync('git', ['ls-remote', '--exit-code', '--refs', 'origin', `refs/tags/${tag}`], {
    cwd: extensionRoot,
    encoding: 'utf8',
    shell: false,
  })

  if (result.status === 0) {
    return true
  }

  if (result.status === 2) {
    return false
  }

  throw new Error(result.stderr.trim() || `failed to query remote tag ${tag}`)
}

/**
 * 确保版本 tag 已指向当前发布提交并存在于远端。
 */
function ensureRemoteTag(tag: string) {
  if (remoteTagExists(tag)) {
    return
  }

  if (!runGit(['tag', '--list', tag], true)) {
    runGit(['tag', '-a', tag, '-m', tag])
  }

  runGit(['push', 'origin', `refs/tags/${tag}`])
}

/**
 * 读取当前发布计划。
 */
async function loadMarketplaceReleasePlan() {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
  const currentVersion = readVersionFromPackageJson(packageJsonContent)
  const currentRef = resolveCurrentReleaseRef()
  const releaseTag = `${releaseTagPrefix}${currentVersion}`

  if (!isMainReleaseRef(currentRef)) {
    return createMarketplaceReleasePlan(currentVersion, null, false, currentRef)
  }

  const { extensionName, publisher } = readMarketplaceIdentity(packageJsonContent)
  const marketplaceVersion = await fetchMarketplaceLatestVersion(publisher, extensionName)
  const tagExists = remoteTagExists(releaseTag)

  return createMarketplaceReleasePlan(currentVersion, marketplaceVersion, tagExists, currentRef)
}

/**
 * 发布命令失败后复查远端，避免已成功写入 Marketplace 的响应丢失导致重试中断。
 */
async function recoverCompletedMarketplacePublish(plan: MarketplaceReleasePlan) {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
  const { extensionName, publisher } = readMarketplaceIdentity(packageJsonContent)
  const marketplaceVersion = await fetchMarketplaceLatestVersion(publisher, extensionName)

  if (marketplaceVersion !== plan.currentVersion) {
    return false
  }

  console.log(`VS Code Marketplace already reports ${marketplaceVersion}; continuing with tag recovery`)
  return true
}

/**
 * 按 Marketplace 与 tag 的实际状态幂等完成发布。
 */
export async function runMarketplaceRelease() {
  const plan = await loadMarketplaceReleasePlan()
  console.log(JSON.stringify(plan, null, 2))

  if (!plan.isMainRef) {
    console.log('VS Code Marketplace release skipped outside main')
    return plan
  }

  if (plan.shouldPublish) {
    try {
      await x('pnpm', ['run', 'publish:vsce'], {
        nodeOptions: {
          cwd: extensionRoot,
          stdio: 'inherit',
        },
        throwOnError: true,
      })
    }
    catch (error) {
      if (!await recoverCompletedMarketplacePublish(plan)) {
        throw error
      }
    }
  }

  if (plan.shouldTag) {
    ensureRemoteTag(plan.releaseTag)
  }

  return plan
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMarketplaceRelease().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
