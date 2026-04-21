import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
/* eslint-disable e18e/ban-dependencies -- release automation scans workspace manifests with fast-glob, consistent with existing repository scripts. */
import fg from 'fast-glob'
import {
  collectPublishableWorkspacePackages,
  extractChangesetPackages,
} from './check-publishable-workspace-changeset'

const CHANGESET_DIR = '.changeset'
const CHANGESET_README = 'README.md'
const AUTO_CHANGESET_FILE = path.resolve(CHANGESET_DIR, 'dependency-upgrade-auto-generated.md')
const VALID_BUMP_TYPES = new Set(['patch', 'minor', 'major'])
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

function formatAutoChangeset(
  packages: string[],
  bumpType: string,
  packageSummaries: Array<{ name: string, summary: string }>,
) {
  const frontmatter = packages
    .map(pkg => `'${pkg}': ${bumpType}`)
    .join('\n')

  const summaryLines = packageSummaries
    .map(item => `- ${item.name}：${item.summary}`)
    .join('\n')

  return `---
${frontmatter}
---

自动补充依赖升级发布记录。
涉及包：
${summaryLines}
`
}

async function collectCurrentChangesetPackages() {
  const files = await fg(`${CHANGESET_DIR}/*.md`, { dot: false, onlyFiles: true })
  const changesetFiles = files.filter((file) => {
    const filename = path.basename(file)
    if (filename === CHANGESET_README) {
      return false
    }
    return path.resolve(file) !== AUTO_CHANGESET_FILE
  })

  const packages = new Set<string>()
  for (const file of changesetFiles) {
    const content = await fs.readFile(path.resolve(file), 'utf8')
    for (const pkg of extractChangesetPackages(content)) {
      packages.add(pkg)
    }
  }
  return packages
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
  if (templatePackageChanged) {
    packageSummaries.push({
      name: 'create-weapp-vite',
      summary: '模板 package.json 依赖版本已更新',
    })
  }

  const releasePackages = resolveDependencyUpgradeReleasePackages({
    changedPublishablePackages,
    templatePackageChanged,
  })

  if (releasePackages.length === 0) {
    await fs.rm(AUTO_CHANGESET_FILE, { force: true })
    return
  }

  const existingChangesetPackages = await collectCurrentChangesetPackages()
  const missingPackages = releasePackages.filter(pkg => !existingChangesetPackages.has(pkg))
  if (missingPackages.length === 0) {
    await fs.rm(AUTO_CHANGESET_FILE, { force: true })
    return
  }

  const visibleSummaries = packageSummaries.filter(item => missingPackages.includes(item.name))
  if (
    missingPackages.includes('create-weapp-vite')
    && !visibleSummaries.some(item => item.name === 'create-weapp-vite')
  ) {
    visibleSummaries.push({
      name: 'create-weapp-vite',
      summary: '基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板',
    })
  }

  const content = formatAutoChangeset(missingPackages, bumpType, visibleSummaries)
  await fs.mkdir(path.dirname(AUTO_CHANGESET_FILE), { recursive: true })
  await fs.writeFile(AUTO_CHANGESET_FILE, content, 'utf8')
  console.log(`Generated ${AUTO_CHANGESET_FILE} for packages: ${missingPackages.join(', ')}`)
}

await main()
