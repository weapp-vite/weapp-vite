import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

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

function getDiffFiles(baseRef: string, pathSpec: string) {
  const output = runGit(['diff', '--name-only', `${baseRef}...HEAD`, '--', pathSpec])
  return output ? output.split('\n').filter(Boolean) : []
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

export function isReleaseWorthyConstantsVersionFile(file: string) {
  return file.startsWith(`${CONSTANTS_PACKAGE_DIR}/src/`)
    || [
      `${CONSTANTS_PACKAGE_DIR}/package.json`,
      `${CONSTANTS_PACKAGE_DIR}/tsdown.config.ts`,
    ].includes(file)
}

export function collectConstantsReleaseVersionIssues(options: {
  changedFiles: string[]
  packageName: string
  tagExists: boolean
  version: string
}) {
  if (!options.tagExists) {
    return []
  }

  const releaseWorthyFiles = options.changedFiles
    .filter(isReleaseWorthyConstantsVersionFile)
    .sort()

  if (releaseWorthyFiles.length === 0) {
    return []
  }

  const tagName = `${options.packageName}@${options.version}`
  return [
    [
      `${options.packageName} is still at ${options.version}, but releasable files changed since ${tagName}.`,
      `Changed files: ${releaseWorthyFiles.join(', ')}`,
      `Run changeset version with a ${options.packageName} changeset before publishing.`,
    ].join('\n'),
  ]
}

async function main() {
  const packageJsonPath = path.join(CONSTANTS_PACKAGE_DIR, 'package.json')
  const content = await fs.readFile(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(content) as {
    name?: string
    version?: string
  }

  if (packageJson.name !== CONSTANTS_PACKAGE_NAME || !packageJson.version) {
    throw new Error(`Invalid ${packageJsonPath}`)
  }

  const tagName = `${packageJson.name}@${packageJson.version}`
  const tagExists = refExists(tagName)
  const changedFiles = tagExists ? getDiffFiles(tagName, CONSTANTS_PACKAGE_DIR) : []
  const issues = collectConstantsReleaseVersionIssues({
    changedFiles,
    packageName: packageJson.name,
    tagExists,
    version: packageJson.version,
  })

  if (issues.length > 0) {
    console.error(issues.join('\n\n'))
    process.exitCode = 1
  }
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await main()
}
