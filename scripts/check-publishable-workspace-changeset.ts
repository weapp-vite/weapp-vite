import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
/* eslint-disable e18e/ban-dependencies -- release guard scans workspace package manifests with fast-glob, consistent with existing repository checks. */
import fg from 'fast-glob'

export interface PublishableWorkspacePackageEntry {
  dir: string
  name: string
  localWorkspaceDependencies: string[]
}

const PACKAGE_JSON_PATTERNS = [
  'packages/**/package.json',
  'packages-runtime/**/package.json',
  '@weapp-core/**/package.json',
  'benchmarks/**/package.json',
  'mpcore/packages/**/package.json',
  'extensions/**/package.json',
]

const NON_RELEASE_PREFIXES = [
  'test/',
  'tests/',
  'test-d/',
  'e2e/',
  'coverage/',
  'docs/',
  'references/',
]

const NON_RELEASE_BASENAMES = new Set([
  'readme.md',
  'changelog.md',
  'license',
  'license.md',
  'tsconfig.json',
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vitest.config.cjs',
  'vitest.setup.ts',
])

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

function resolveBaseRef() {
  const args = process.argv.slice(2)
  const baseIndex = args.indexOf('--base')
  if (baseIndex >= 0 && args[baseIndex + 1]) {
    return args[baseIndex + 1]
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

export function extractChangesetPackages(content: string) {
  const lines = content.split('\n')
  let start = -1
  let end = -1

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim()
    if (line === '---') {
      if (start === -1) {
        start = i
      }
      else {
        end = i
        break
      }
    }
  }

  if (start === -1 || end === -1 || end <= start + 1) {
    return []
  }

  const packages = new Set<string>()
  for (let i = start + 1; i < end; i += 1) {
    const trimmed = lines[i]?.trim()
    if (!trimmed) {
      continue
    }
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex <= 0) {
      continue
    }
    let key = trimmed.slice(0, colonIndex).trim()
    if (
      (key.startsWith('"') && key.endsWith('"'))
      || (key.startsWith('\'') && key.endsWith('\''))
    ) {
      key = key.slice(1, -1)
    }
    if (key) {
      packages.add(key)
    }
  }

  return [...packages]
}

function collectLocalWorkspaceDependencyNames(
  packageJson: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  },
  workspaceNames: Set<string>,
) {
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const
  const names = new Set<string>()

  for (const section of sections) {
    const deps = packageJson[section]
    if (!deps) {
      continue
    }
    for (const dependencyName of Object.keys(deps)) {
      if (workspaceNames.has(dependencyName)) {
        names.add(dependencyName)
      }
    }
  }

  return [...names].sort()
}

export async function collectPublishableWorkspacePackages() {
  const packageJsonFiles = await fg(PACKAGE_JSON_PATTERNS, {
    dot: false,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/test/**', '**/tests/**'],
  })

  const manifests = await Promise.all(packageJsonFiles.map(async (file) => {
    const content = await fs.readFile(file, 'utf8')
    return {
      file,
      packageJson: JSON.parse(content) as {
        name?: string
        private?: boolean
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
        optionalDependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
      },
    }
  }))

  const publishable = manifests
    .filter(({ packageJson }) => packageJson.private !== true && typeof packageJson.name === 'string')
    .map(({ file, packageJson }) => ({
      dir: path.posix.dirname(file),
      name: packageJson.name as string,
      packageJson,
    }))
    .sort((a, b) => a.dir.localeCompare(b.dir))

  const workspaceNames = new Set(publishable.map(item => item.name))

  return publishable.map(item => ({
    dir: item.dir,
    name: item.name,
    localWorkspaceDependencies: collectLocalWorkspaceDependencyNames(item.packageJson, workspaceNames),
  }))
}

export function isReleaseWorthyWorkspaceFile(file: string, packageDir: string) {
  if (!file.startsWith(`${packageDir}/`)) {
    return false
  }

  const relativePath = file.slice(packageDir.length + 1).replaceAll('\\', '/')
  if (!relativePath) {
    return false
  }

  const lowerRelativePath = relativePath.toLowerCase()
  if (NON_RELEASE_PREFIXES.some(prefix => lowerRelativePath.startsWith(prefix))) {
    return false
  }

  const lowerBaseName = path.posix.basename(lowerRelativePath)
  if (NON_RELEASE_BASENAMES.has(lowerBaseName)) {
    return false
  }

  return true
}

export function collectPublishableWorkspaceChangesetIssues(options: {
  packages: PublishableWorkspacePackageEntry[]
  changedFiles: string[]
  changesetPackages: Set<string>
}) {
  const changedPackageNames = options.packages
    .filter(pkg => options.changedFiles.some(file => isReleaseWorthyWorkspaceFile(file, pkg.dir)))
    .map(pkg => pkg.name)
    .sort()

  if (changedPackageNames.length === 0) {
    return []
  }

  const changedPackageNameSet = new Set(changedPackageNames)
  const missingChangedPackages = changedPackageNames
    .filter(name => !options.changesetPackages.has(name))

  const releaseGraphViolations = options.packages
    .filter(pkg => options.changesetPackages.has(pkg.name))
    .flatMap((pkg) => {
      const missingDependencies = pkg.localWorkspaceDependencies
        .filter(depName => changedPackageNameSet.has(depName) && !options.changesetPackages.has(depName))
      return missingDependencies.map(depName => `${pkg.name} -> ${depName}`)
    })

  const issues: string[] = []
  if (missingChangedPackages.length > 0) {
    issues.push(
      [
        'Missing changeset for releasable publishable workspace packages.',
        `Changed packages: ${changedPackageNames.join(', ')}`,
        `Missing in changesets: ${missingChangedPackages.join(', ')}`,
      ].join('\n'),
    )
  }

  if (releaseGraphViolations.length > 0) {
    issues.push(
      [
        'Releasing packages depend on changed workspace packages that are not in the release set.',
        ...releaseGraphViolations.map(item => `- ${item}`),
      ].join('\n'),
    )
  }

  return issues
}

async function main() {
  const baseRef = resolveBaseRef()
  const changedWorkspaceFiles = getDiffFiles(baseRef)
  if (changedWorkspaceFiles.length === 0) {
    return
  }

  const packages = await collectPublishableWorkspacePackages()
  const changedChangesetFiles = getDiffFiles(baseRef, '.changeset')
    .filter(file => file.endsWith('.md') && path.basename(file) !== 'README.md')

  const changesetPackages = new Set<string>()
  for (const file of changedChangesetFiles) {
    const content = await fs.readFile(path.resolve(file), 'utf8')
    for (const pkg of extractChangesetPackages(content)) {
      changesetPackages.add(pkg)
    }
  }

  const issues = collectPublishableWorkspaceChangesetIssues({
    packages,
    changedFiles: changedWorkspaceFiles,
    changesetPackages,
  })

  if (issues.length > 0) {
    console.error([
      ...issues,
      'Add .changeset entries for each changed publishable workspace package that must participate in this release.',
    ].join('\n\n'))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
