import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export interface MarketplaceReleasePlan {
  currentVersion: string
  previousVersion: null | string
  releaseTag: string
  shouldPublish: boolean
  tagExists: boolean
}

const extensionRoot = path.resolve(process.cwd())
const packageJsonPath = path.join(extensionRoot, 'package.json')
const releaseTagPrefix = 'vscode-extension-v'

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
 * 根据版本变化与 tag 状态生成发布计划。
 */
export function createMarketplaceReleasePlan(currentVersion: string, previousVersion: null | string, tagExists: boolean): MarketplaceReleasePlan {
  const releaseTag = `${releaseTagPrefix}${currentVersion}`

  return {
    currentVersion,
    previousVersion,
    releaseTag,
    shouldPublish: Boolean(previousVersion && previousVersion !== currentVersion && !tagExists),
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
function loadMarketplaceReleasePlan() {
  const currentVersion = readVersionFromPackageJson(fs.readFileSync(packageJsonPath, 'utf8'))
  const previousVersion = readPreviousVersion()
  const tagExists = runGit(['tag', '--list', `${releaseTagPrefix}${currentVersion}`], true).length > 0

  return createMarketplaceReleasePlan(currentVersion, previousVersion, tagExists)
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
    `previous_version=${plan.previousVersion ?? ''}`,
    `release_tag=${plan.releaseTag}`,
    `should_publish=${String(plan.shouldPublish)}`,
    `tag_exists=${String(plan.tagExists)}`,
  ]

  fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`)
}

const plan = loadMarketplaceReleasePlan()

writeGitHubOutput(plan)
console.log(JSON.stringify(plan, null, 2))
