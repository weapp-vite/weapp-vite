import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'
/* eslint-disable e18e/ban-dependencies -- release automation scans workspace manifests with fast-glob, consistent with existing repository scripts. */
import fg from 'fast-glob'
import { writeUniqueChangeset } from './changeset-utils'
import {
  collectPublishableWorkspacePackages,
  isCurrentModuleEntry,
} from './check-publishable-workspace-changeset'

const VALID_BUMP_TYPES = new Set(['patch', 'minor', 'major'])
const AUTO_CHANGESET_PREFIX = 'dependency-upgrade'
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

type DependencySection = typeof DEPENDENCY_SECTIONS[number]

interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface DependencySpecChange {
  section: DependencySection
  name: string
  before: string | null
  after: string | null
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

  return refExists('HEAD') ? 'HEAD' : 'main'
}

function resolveBumpType() {
  const args = process.argv.slice(2)
  const bumpIndex = args.indexOf('--bump')
  const rawBump = bumpIndex >= 0 && args[bumpIndex + 1] ? args[bumpIndex + 1] : 'patch'
  if (!VALID_BUMP_TYPES.has(rawBump)) {
    throw new Error(`Invalid --bump value: ${rawBump}. Valid values: patch, minor, major`)
  }
  return rawBump
}

function readFileAtRef(ref: string, file: string) {
  const result = spawnSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' })
  if (result.status !== 0) {
    return null
  }
  return result.stdout
}

function parsePackageJson(content: string | null): PackageJsonLike {
  if (!content) {
    return {}
  }

  try {
    return JSON.parse(content) as PackageJsonLike
  }
  catch {
    return {}
  }
}

export function collectDependencySpecChanges(before: PackageJsonLike, after: PackageJsonLike) {
  const changes: DependencySpecChange[] = []

  for (const section of DEPENDENCY_SECTIONS) {
    const beforeDeps = before[section] ?? {}
    const afterDeps = after[section] ?? {}
    const dependencyNames = new Set([...Object.keys(beforeDeps), ...Object.keys(afterDeps)])

    for (const name of [...dependencyNames].sort()) {
      const beforeSpec = beforeDeps[name] ?? null
      const afterSpec = afterDeps[name] ?? null
      if (beforeSpec !== afterSpec) {
        changes.push({
          section,
          name,
          before: beforeSpec,
          after: afterSpec,
        })
      }
    }
  }

  return changes
}

export function resolveDependencyUpgradeReleasePackages(options: {
  changedPublishablePackages: string[]
  templatePackageChanged: boolean
}) {
  const packages = new Set(options.changedPublishablePackages)
  if (
    options.templatePackageChanged
    || packages.has('weapp-vite')
    || packages.has('wevu')
  ) {
    packages.add('create-weapp-vite')
  }
  return [...packages].sort()
}

/**
 * 仓库级依赖升级会改 lockfile / catalog，因此有实际变化时为全部可发布包补 patch。
 */
export function collectPublishableReleasePackageNames(packages: Array<{ name: string }>) {
  return [...new Set(packages.map(pkg => pkg.name))].sort()
}

/**
 * 本次 run 是否产生了需要写入 changeset 的依赖升级。
 */
export function shouldWriteDependencyUpgradeChangeset(options: {
  changedPublishablePackages: string[]
  templatePackageChanged: boolean
}) {
  return options.changedPublishablePackages.length > 0 || options.templatePackageChanged
}

function formatDependencyChangeSummary(changes: DependencySpecChange[]) {
  const maxItems = 6
  const items = changes
    .slice(0, maxItems)
    .map(change => `${change.section}.${change.name}`)

  if (changes.length > maxItems) {
    items.push(`以及另外 ${changes.length - maxItems} 项`)
  }

  return items.join('、')
}

/**
 * 用中文摘要记录这一批实际发生变化的依赖，不把未改动的包写进正文。
 */
export function formatDependencyUpgradeBody(packageSummaries: Array<{ name: string, summary: string }>) {
  const summaryLines = packageSummaries
    .map(item => `- ${item.name}：${item.summary}`)
    .join('\n')

  return `自动补充依赖升级发布记录。
涉及包：
${summaryLines}
`
}

async function hasTemplateDependencyChanges(baseRef: string) {
  const templatePackageJsonFiles = await fg('templates/*/package.json', {
    dot: false,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  })

  for (const file of templatePackageJsonFiles) {
    const before = parsePackageJson(readFileAtRef(baseRef, file))
    const after = parsePackageJson(await fs.readFile(file, 'utf8'))
    if (collectDependencySpecChanges(before, after).length > 0) {
      return true
    }
  }

  return false
}

async function main() {
  const baseRef = resolveBaseRef()
  const bumpType = resolveBumpType()
  const publishablePackages = await collectPublishableWorkspacePackages()
  const changedPublishablePackages: string[] = []
  const packageSummaries: Array<{ name: string, summary: string }> = []

  for (const pkg of publishablePackages) {
    const packageJsonPath = `${pkg.dir}/package.json`
    const before = parsePackageJson(readFileAtRef(baseRef, packageJsonPath))
    const after = parsePackageJson(await fs.readFile(packageJsonPath, 'utf8'))
    const changes = collectDependencySpecChanges(before, after)

    if (changes.length === 0) {
      continue
    }

    changedPublishablePackages.push(pkg.name)
    packageSummaries.push({
      name: pkg.name,
      summary: formatDependencyChangeSummary(changes),
    })
  }

  const templatePackageChanged = await hasTemplateDependencyChanges(baseRef)
  if (templatePackageChanged && !packageSummaries.some(item => item.name === 'create-weapp-vite')) {
    packageSummaries.push({
      name: 'create-weapp-vite',
      summary: '模板 package.json 依赖版本已更新',
    })
  }

  if (!shouldWriteDependencyUpgradeChangeset({
    changedPublishablePackages,
    templatePackageChanged,
  })) {
    return
  }

  if (
    (changedPublishablePackages.includes('weapp-vite')
      || changedPublishablePackages.includes('wevu')
      || templatePackageChanged)
    && !packageSummaries.some(item => item.name === 'create-weapp-vite')
  ) {
    packageSummaries.push({
      name: 'create-weapp-vite',
      summary: '基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板',
    })
  }

  const releasePackages = collectPublishableReleasePackageNames(publishablePackages)
  const writtenPath = await writeUniqueChangeset({
    prefix: AUTO_CHANGESET_PREFIX,
    packages: releasePackages,
    bumpType,
    body: formatDependencyUpgradeBody(packageSummaries),
  })
  console.log(`Generated ${writtenPath} for packages: ${releasePackages.join(', ')}`)
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await main()
}
