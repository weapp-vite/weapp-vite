import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { collectChangesetPackages, hasReleaseArtifactsForPackage } from './changeset-utils'

const CONSTANTS_PACKAGE_DIR = '@weapp-core/constants'
const CONSTANTS_PACKAGE_NAME = '@weapp-core/constants'

function runGit(args: string[]) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim() || `git ${args.join(' ')} failed`
    throw new Error(message)
  }
  return result.stdout.trim()
}

function refExists(ref: string) {
  const result = spawnSync('git', ['rev-parse', '--verify', ref], { stdio: 'ignore' })
  return result.status === 0
}

export function resolveConstantsReleaseBaseRef(version: string, tagExists: boolean) {
  return tagExists ? `${CONSTANTS_PACKAGE_NAME}@${version}` : 'HEAD'
}

function resolveReleaseBaseRef() {
  const packageJsonPath = path.join(CONSTANTS_PACKAGE_DIR, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    name?: string
    version?: string
  }

  if (packageJson.name !== CONSTANTS_PACKAGE_NAME || !packageJson.version) {
    throw new Error(`Invalid ${packageJsonPath}`)
  }

  const tagName = `${packageJson.name}@${packageJson.version}`
  return resolveConstantsReleaseBaseRef(
    packageJson.version,
    refExists(`${tagName}^{commit}`),
  )
}

function resolveBaseRef(args = process.argv.slice(2)) {
  const baseIndex = args.indexOf('--base')
  if (baseIndex >= 0 && args[baseIndex + 1]) {
    return args[baseIndex + 1]
  }

  if (args.includes('--release')) {
    return resolveReleaseBaseRef()
  }

  const envBase = process.env.GITHUB_BASE_REF?.trim()
  if (envBase) {
    const remoteBase = `origin/${envBase}`
    if (refExists(remoteBase)) {
      return remoteBase
    }
    if (refExists(envBase)) {
      return envBase
    }
  }

  if (refExists('origin/main')) {
    return 'origin/main'
  }
  if (refExists('main')) {
    return 'main'
  }

  return refExists('HEAD~1') ? 'HEAD~1' : 'HEAD'
}

function getDiffFiles(baseRef: string, pathSpec?: string) {
  let base = baseRef
  if (baseRef !== 'HEAD' && baseRef !== 'HEAD~1') {
    try {
      base = runGit(['merge-base', 'HEAD', baseRef])
    }
    catch {
      base = baseRef
    }
  }

  const args = ['diff', '--name-only', `${base}...HEAD`]
  if (pathSpec) {
    args.push('--', pathSpec)
  }
  const output = runGit(args)
  return output ? output.split('\n').filter(Boolean) : []
}

function isReleaseWorthyConstantsFile(file: string) {
  return file.startsWith('@weapp-core/constants/src/')
    || [
      '@weapp-core/constants/package.json',
      '@weapp-core/constants/tsdown.config.ts',
    ].includes(file)
}

export function collectConstantsChangesetIssues(options: {
  changedConstantsFiles: string[]
  changesetPackages: ReadonlySet<string>
}) {
  const hasReleaseWorthyConstantsChange = options.changedConstantsFiles.some(isReleaseWorthyConstantsFile)
  if (!hasReleaseWorthyConstantsChange) {
    return []
  }

  const hasConstantsRelease = options.changesetPackages.has(CONSTANTS_PACKAGE_NAME)
    || hasReleaseArtifactsForPackage(options.changedConstantsFiles, CONSTANTS_PACKAGE_DIR)

  return hasConstantsRelease
    ? []
    : ['Missing changeset for @weapp-core/constants. Add a changeset when releasable files under @weapp-core/constants change.']
}

function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
  if (!entryArg) {
    return false
  }

  const resolvedEntryPath = path.isAbsolute(entryArg)
    ? entryArg
    : path.resolve(entryArg)

  try {
    return moduleUrl === pathToFileURL(resolvedEntryPath).href
  }
  catch {
    return false
  }
}

async function main() {
  const baseRef = resolveBaseRef()
  const changedConstantsFiles = getDiffFiles(baseRef, '@weapp-core/constants')
  const changedChangesetFiles = getDiffFiles(baseRef, '.changeset')
    .filter(file => file.endsWith('.md') && path.basename(file) !== 'README.md')

  const changesetPackages = await collectChangesetPackages(changedChangesetFiles.map(file => path.resolve(file)))
  const issues = collectConstantsChangesetIssues({
    changedConstantsFiles,
    changesetPackages,
  })

  if (issues.length > 0) {
    console.error(issues.join('\n'))
    process.exitCode = 1
  }
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await main()
}
