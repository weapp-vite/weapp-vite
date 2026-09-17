import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'
import { parse } from 'yaml'
import { writeUniqueChangeset } from './changeset-utils'
import {
  collectPublishableWorkspacePackages,
  isCurrentModuleEntry,
} from './check-publishable-workspace-changeset'

const WORKSPACE_FILE = 'pnpm-workspace.yaml'
const AUTO_CHANGESET_PREFIX = 'catalog-upgrade'
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

/**
 * 本次 catalog 是否发生了需要写入 changeset 的版本变更。
 */
export function shouldWriteCatalogUpgradeChangeset(
  changedKeys: string[],
  changedNamedKeys: Record<string, Set<string>>,
) {
  return changedKeys.length > 0 || Object.keys(changedNamedKeys).length > 0
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

/**
 * 用中文摘要记录这一批 catalog 键变化。
 */
export function formatCatalogUpgradeSummary(
  changedKeys: string[],
  changedNamedKeys: Record<string, Set<string>>,
) {
  const namedCatalogSummary = Object.entries(changedNamedKeys)
    .map(([catalogName, keys]) => `${catalogName}(${[...keys].sort().join(', ')})`)
    .join('；')

  const defaultSummary = changedKeys.length > 0 ? changedKeys.join(', ') : '无'
  const namedSummary = namedCatalogSummary || '无'

  return `基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
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

  if (!shouldWriteCatalogUpgradeChangeset(changedKeys, changedNamedKeys)) {
    return
  }

  const publishablePackages = await collectPublishableWorkspacePackages()
  const releasePackages = [...new Set(publishablePackages.map(pkg => pkg.name))].sort()
  if (releasePackages.length === 0) {
    return
  }

  const writtenPath = await writeUniqueChangeset({
    prefix: AUTO_CHANGESET_PREFIX,
    packages: releasePackages,
    bumpType,
    body: formatCatalogUpgradeSummary(changedKeys, changedNamedKeys),
  })
  console.log(`Generated ${writtenPath} for packages: ${releasePackages.join(', ')}`)
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await main()
}
