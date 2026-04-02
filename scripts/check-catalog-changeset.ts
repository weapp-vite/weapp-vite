import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import { parse } from 'yaml'

const WORKSPACE_FILE = 'pnpm-workspace.yaml'
const CHANGESET_DIR = '.changeset'
const CHANGESET_README = 'README.md'

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

function getDiffFiles(baseRef: string, pathSpec?: string) {
  const base = resolveDiffBase(baseRef)
  const args = ['diff', '--name-only', `${base}...HEAD`]
  if (pathSpec) {
    args.push('--', pathSpec)
  }
  const output = runGit(args)
  return output ? output.split('\n').filter(Boolean) : []
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

interface CatalogSnapshot {
  defaultCatalog: Record<string, string>
  namedCatalogs: Record<string, Record<string, string>>
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
  const packageJsonFiles = await fg(['packages/**/package.json', 'packages-runtime/**/package.json', 'benchmarks/**/package.json'], {
    dot: false,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/test/**'],
  })

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

async function main() {
  const baseRef = resolveBaseRef()
  const diffBase = resolveDiffBase(baseRef)
  const changedFiles = getDiffFiles(baseRef)

  if (!changedFiles.includes(WORKSPACE_FILE)) {
    return
  }

  const beforeCatalog = parseCatalog(readFileAtRef(diffBase, WORKSPACE_FILE))
  const afterCatalog = parseCatalog(await fs.readFile(WORKSPACE_FILE, 'utf8'))
  const changedKeys = changedCatalogKeys(beforeCatalog.defaultCatalog, afterCatalog.defaultCatalog)
  const changedNamedKeys = changedNamedCatalogKeys(beforeCatalog.namedCatalogs, afterCatalog.namedCatalogs)
  const hasNamedCatalogChanges = Object.keys(changedNamedKeys).length > 0

  if (changedKeys.length === 0 && !hasNamedCatalogChanges) {
    return
  }

  const affectedPackages = await collectAffectedPackages(changedKeys, changedNamedKeys)
  if (affectedPackages.length === 0) {
    return
  }

  const allChangesetFiles = await fg(`${CHANGESET_DIR}/*.md`, {
    dot: false,
    onlyFiles: true,
  })
  const changedChangesetFiles = allChangesetFiles
    .filter(file => path.basename(file) !== CHANGESET_README)

  const changesetPackages = new Set<string>()
  for (const file of changedChangesetFiles) {
    const content = await fs.readFile(path.resolve(file), 'utf8')
    for (const pkg of extractChangesetPackages(content)) {
      changesetPackages.add(pkg)
    }
  }

  const missing = affectedPackages.filter(pkg => !changesetPackages.has(pkg))
  if (missing.length > 0) {
    const namedCatalogSummary = Object.entries(changedNamedKeys)
      .map(([catalogName, keys]) => `${catalogName}: ${[...keys].join(', ')}`)
      .join('; ')

    console.error(
      [
        `Catalog keys changed: ${changedKeys.join(', ')}`,
        `Named catalog keys changed: ${namedCatalogSummary || 'none'}`,
        `Affected publishable packages: ${affectedPackages.join(', ')}`,
        `Missing in changesets: ${missing.join(', ')}`,
        'Please add .changeset entries for all affected packages.',
      ].join('\n'),
    )
    process.exitCode = 1
  }
}

await main()
