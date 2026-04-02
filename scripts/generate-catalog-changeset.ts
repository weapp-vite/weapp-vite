import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import { parse } from 'yaml'

const WORKSPACE_FILE = 'pnpm-workspace.yaml'
const CHANGESET_DIR = '.changeset'
const CHANGESET_README = 'README.md'
const AUTO_CHANGESET_FILE = path.resolve(CHANGESET_DIR, 'catalog-auto-generated.md')
const VALID_BUMP_TYPES = new Set(['patch', 'minor', 'major'])

interface CatalogSnapshot {
  defaultCatalog: Record<string, string>
  namedCatalogs: Record<string, Record<string, string>>
}

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

function resolveDiffBase(baseRef: string) {
  if (baseRef === 'HEAD' || baseRef === 'HEAD~1') {
    return baseRef
  }
  try {
    return runGit(['merge-base', 'HEAD', baseRef])
  }
  catch {
    return baseRef
  }
}

function readFileAtRef(ref: string, file: string) {
  const result = spawnSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' })
  if (result.status !== 0) {
    return null
  }
  return result.stdout
}

function toCatalogRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') {
      out[key] = raw
    }
  }
  return out
}

function parseCatalog(content: string | null): CatalogSnapshot {
  if (!content) {
    return { defaultCatalog: {}, namedCatalogs: {} }
  }

  const parsed = parse(content) as {
    catalog?: Record<string, unknown>
    catalogs?: Record<string, Record<string, unknown>>
  } | null

  const namedCatalogs: Record<string, Record<string, string>> = {}
  for (const [catalogName, catalogValue] of Object.entries(parsed?.catalogs ?? {})) {
    namedCatalogs[catalogName] = toCatalogRecord(catalogValue)
  }

  return {
    defaultCatalog: toCatalogRecord(parsed?.catalog),
    namedCatalogs,
  }
}

function changedCatalogKeys(before: Record<string, string>, after: Record<string, string>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of keys) {
    if ((before[key] ?? null) !== (after[key] ?? null)) {
      changed.push(key)
    }
  }
  return changed.sort()
}

function changedNamedCatalogKeys(
  before: Record<string, Record<string, string>>,
  after: Record<string, Record<string, string>>,
) {
  const catalogNames = new Set([...Object.keys(before), ...Object.keys(after)])
  const result: Record<string, Set<string>> = {}

  for (const catalogName of catalogNames) {
    const beforeCatalog = before[catalogName] ?? {}
    const afterCatalog = after[catalogName] ?? {}
    const changedKeys = changedCatalogKeys(beforeCatalog, afterCatalog)
    if (changedKeys.length > 0) {
      result[catalogName] = new Set(changedKeys)
    }
  }

  return result
}

async function collectAffectedPackages(
  defaultCatalogKeys: string[],
  namedCatalogChangedKeys: Record<string, Set<string>>,
) {
  const packageJsonFiles = await fg(
    ['packages/**/package.json', 'packages-runtime/**/package.json', 'benchmarks/**/package.json', '@weapp-core/**/package.json'],
    {
      dot: false,
      onlyFiles: true,
      ignore: ['**/node_modules/**', '**/test/**'],
    },
  )

  const keySet = new Set(defaultCatalogKeys)
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const
  const affected = new Set<string>()

  for (const file of packageJsonFiles) {
    const content = await fs.readFile(file, 'utf8')
    const json = JSON.parse(content) as {
      name?: string
      private?: boolean
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }

    if (!json.name || json.private === true) {
      continue
    }

    let hit = false
    for (const section of sections) {
      const deps = json[section]
      if (!deps) {
        continue
      }
      for (const [depName, depSpec] of Object.entries(deps)) {
        if (depSpec === 'catalog:' && keySet.has(depName)) {
          hit = true
          break
        }

        if (depSpec.startsWith('catalog:') && depSpec !== 'catalog:') {
          const namedCatalogName = depSpec.slice('catalog:'.length)
          if (namedCatalogName && namedCatalogChangedKeys[namedCatalogName]?.has(depName)) {
            hit = true
            break
          }
        }
      }
      if (hit) {
        break
      }
    }

    if (hit) {
      affected.add(json.name)
    }
  }

  return [...affected].sort()
}

function extractChangesetPackages(content: string) {
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

async function collectManualChangesetPackages() {
  const files = await fg(`${CHANGESET_DIR}/*.md`, { dot: false, onlyFiles: true })
  const manualFiles = files.filter((file) => {
    const filename = path.basename(file)
    if (filename === CHANGESET_README) {
      return false
    }
    return path.resolve(file) !== AUTO_CHANGESET_FILE
  })

  const packages = new Set<string>()
  for (const file of manualFiles) {
    const content = await fs.readFile(path.resolve(file), 'utf8')
    for (const pkg of extractChangesetPackages(content)) {
      packages.add(pkg)
    }
  }
  return packages
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

function formatAutoChangeset(
  packages: string[],
  bumpType: string,
  changedKeys: string[],
  changedNamedKeys: Record<string, Set<string>>,
) {
  const frontmatter = packages
    .map(pkg => `'${pkg}': ${bumpType}`)
    .join('\n')

  const namedCatalogSummary = Object.entries(changedNamedKeys)
    .map(([catalogName, keys]) => `${catalogName}(${[...keys].sort().join(', ')})`)
    .join('；')

  const defaultSummary = changedKeys.length > 0 ? changedKeys.join(', ') : '无'
  const namedSummary = namedCatalogSummary || '无'

  return `---
${frontmatter}
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：${defaultSummary}。命名 catalog 变更键：${namedSummary}。
`
}

async function main() {
  const bumpType = resolveBumpType()
  const baseRef = resolveBaseRef()
  const diffBase = resolveDiffBase(baseRef)

  const beforeCatalog = parseCatalog(readFileAtRef(diffBase, WORKSPACE_FILE))
  const afterCatalog = parseCatalog(await fs.readFile(WORKSPACE_FILE, 'utf8'))
  const changedKeys = changedCatalogKeys(beforeCatalog.defaultCatalog, afterCatalog.defaultCatalog)
  const changedNamedKeys = changedNamedCatalogKeys(beforeCatalog.namedCatalogs, afterCatalog.namedCatalogs)
  const hasNamedCatalogChanges = Object.keys(changedNamedKeys).length > 0

  if (changedKeys.length === 0 && !hasNamedCatalogChanges) {
    await fs.rm(AUTO_CHANGESET_FILE, { force: true })
    return
  }

  const affectedPackages = await collectAffectedPackages(changedKeys, changedNamedKeys)
  if (affectedPackages.length === 0) {
    await fs.rm(AUTO_CHANGESET_FILE, { force: true })
    return
  }

  const manualChangesetPackages = await collectManualChangesetPackages()
  const missingPackages = affectedPackages.filter(pkg => !manualChangesetPackages.has(pkg))

  if (missingPackages.length === 0) {
    await fs.rm(AUTO_CHANGESET_FILE, { force: true })
    return
  }

  const content = formatAutoChangeset(
    missingPackages,
    bumpType,
    changedKeys,
    changedNamedKeys,
  )

  await fs.mkdir(path.dirname(AUTO_CHANGESET_FILE), { recursive: true })
  await fs.writeFile(AUTO_CHANGESET_FILE, content, 'utf8')
  console.log(`Generated ${AUTO_CHANGESET_FILE} for packages: ${missingPackages.join(', ')}`)
}

await main()
