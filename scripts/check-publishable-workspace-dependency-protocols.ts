import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
/* eslint-disable e18e/ban-dependencies -- policy guard scans workspace package manifests with fast-glob, consistent with release checks. */
import fg from 'fast-glob'

const PACKAGE_JSON_PATTERNS = [
  'packages/**/package.json',
  'packages-runtime/**/package.json',
  '@weapp-core/**/package.json',
  'benchmarks/**/package.json',
  'mpcore/packages/**/package.json',
  'extensions/**/package.json',
]

const EXPECTED_WORKSPACE_SPEC = 'workspace:*'
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

interface PackageJsonLike {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

async function collectPackageJsonFiles() {
  return fg(PACKAGE_JSON_PATTERNS, {
    dot: false,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/test/**', '**/tests/**'],
  })
}

async function readPackageJson(file: string) {
  const content = await fs.readFile(file, 'utf8')
  return JSON.parse(content) as PackageJsonLike
}

export function collectWorkspaceProtocolViolations(options: {
  file: string
  packageJson: PackageJsonLike
  workspacePackageNames: Set<string>
}) {
  if (options.packageJson.private === true || typeof options.packageJson.name !== 'string') {
    return []
  }

  const violations: string[] = []

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = options.packageJson[section]
    if (!deps) {
      continue
    }

    for (const [dependencyName, spec] of Object.entries(deps)) {
      if (!options.workspacePackageNames.has(dependencyName) || !spec.startsWith('workspace:')) {
        continue
      }

      if (spec !== EXPECTED_WORKSPACE_SPEC) {
        violations.push(`${path.normalize(options.file)} -> ${section}.${dependencyName}=${spec}`)
      }
    }
  }

  return violations
}

export function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
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
  const packageJsonFiles = await collectPackageJsonFiles()
  const manifests = await Promise.all(packageJsonFiles.map(async file => ({
    file,
    packageJson: await readPackageJson(file),
  })))

  const workspacePackageNames = new Set(
    manifests
      .map(({ packageJson }) => packageJson.name)
      .filter((name): name is string => typeof name === 'string'),
  )

  const violations = manifests.flatMap(({ file, packageJson }) => collectWorkspaceProtocolViolations({
    file,
    packageJson,
    workspacePackageNames,
  }))

  if (violations.length > 0) {
    console.error(`Expected publishable workspace dependencies to use ${EXPECTED_WORKSPACE_SPEC}:`)
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exitCode = 1
  }
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await main()
}
