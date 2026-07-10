import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix, resolve } from 'node:path'
import process from 'node:process'

function resolveRoot() {
  const rootIndex = process.argv.indexOf('--root')
  if (rootIndex >= 0 && process.argv[rootIndex + 1]) {
    return resolve(process.argv[rootIndex + 1])
  }
  return process.cwd()
}

const ROOT = resolveRoot()
const CHANGESET_DIR = join(ROOT, '.changeset')
const badFiles = []
const unknownPackageIssues = []

function stripPackagePatternValue(line) {
  const rawValue = line.trim().slice(1).trim()
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"'))
    || (rawValue.startsWith('\'') && rawValue.endsWith('\''))
  ) {
    return rawValue.slice(1, -1)
  }
  return rawValue
}

function collectWorkspacePatterns() {
  const content = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8')
  const patterns = []
  let inPackages = false

  for (const line of content.split('\n')) {
    if (line.trim() === 'packages:') {
      inPackages = true
      continue
    }
    if (inPackages && line && !line.startsWith(' ')) {
      break
    }
    if (!inPackages || !line.trim().startsWith('- ')) {
      continue
    }
    patterns.push(stripPackagePatternValue(line))
  }

  return patterns
}

function isIgnoredByPattern(relativePath, pattern) {
  const normalizedPattern = pattern.slice(1).replaceAll('\\', '/')
  const source = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '\0')
    .replaceAll('*', '[^/]*')
    .replaceAll('\0', '.*')
  return new RegExp(`^${source}$`).test(relativePath)
}

function collectPackageDirsFromPattern(pattern) {
  if (pattern.startsWith('!')) {
    return []
  }

  const normalizedPattern = pattern.replaceAll('\\', '/')
  if (!normalizedPattern.includes('*')) {
    return [normalizedPattern]
  }

  const starIndex = normalizedPattern.indexOf('*')
  const prefix = normalizedPattern.slice(0, starIndex)
  const suffix = normalizedPattern.slice(starIndex + 1)
  const baseDir = prefix.endsWith('/') ? prefix.slice(0, -1) : posix.dirname(prefix)
  const basePath = join(ROOT, baseDir)

  if (!existsSync(basePath)) {
    return []
  }

  return readdirSync(basePath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `${baseDir}/${entry.name}${suffix}`.replaceAll('\\', '/'))
}

function collectWorkspacePackageNames() {
  const patterns = collectWorkspacePatterns()
  const ignoredPatterns = patterns.filter(pattern => pattern.startsWith('!'))
  const packageNames = new Set()

  for (const pattern of patterns) {
    for (const relativeDir of collectPackageDirsFromPattern(pattern)) {
      if (ignoredPatterns.some(ignoredPattern => isIgnoredByPattern(relativeDir, ignoredPattern))) {
        continue
      }

      const packageJsonPath = join(ROOT, relativeDir, 'package.json')
      if (!existsSync(packageJsonPath)) {
        continue
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
      if (typeof packageJson.name === 'string' && packageJson.name) {
        packageNames.add(packageJson.name)
      }
    }
  }

  return packageNames
}

function extractChangesetPackages(content) {
  const closingIndex = content.indexOf('\n---\n', 4)
  if (!content.startsWith('---\n') || closingIndex === -1) {
    return []
  }

  const frontmatter = content.slice(4, closingIndex).split('\n')
  const packages = new Set()

  for (const line of frontmatter) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex <= 0) {
      continue
    }

    let packageName = trimmed.slice(0, colonIndex).trim()
    if (
      (packageName.startsWith('"') && packageName.endsWith('"'))
      || (packageName.startsWith('\'') && packageName.endsWith('\''))
    ) {
      packageName = packageName.slice(1, -1)
    }
    if (packageName) {
      packages.add(packageName)
    }
  }

  return [...packages]
}

const workspacePackageNames = collectWorkspacePackageNames()

for (const entry of readdirSync(CHANGESET_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') {
    continue
  }

  const filePath = join(CHANGESET_DIR, entry.name)
  const content = readFileSync(filePath, 'utf8')

  if (!content.startsWith('---\n')) {
    badFiles.push(entry.name)
    continue
  }

  const closingIndex = content.indexOf('\n---\n', 4)

  if (closingIndex === -1) {
    badFiles.push(entry.name)
    continue
  }

  for (const packageName of extractChangesetPackages(content)) {
    if (!workspacePackageNames.has(packageName)) {
      unknownPackageIssues.push(`${entry.name}: ${packageName}`)
    }
  }
}

if (badFiles.length > 0 || unknownPackageIssues.length > 0) {
  if (badFiles.length > 0) {
    console.error('[changeset-frontmatter] 以下 changeset frontmatter 格式无效：')
    for (const file of badFiles) {
      console.error(`- .changeset/${file}`)
    }
    console.error('期望格式：文件必须以 --- 开头，并包含成对的 frontmatter 分隔线。')
  }

  if (unknownPackageIssues.length > 0) {
    console.error('[changeset-frontmatter] 以下 changeset 引用了不存在的 workspace package：')
    for (const issue of unknownPackageIssues) {
      console.error(`- .changeset/${issue}`)
    }
    console.error('请使用 package.json 中的真实 name 字段。')
  }

  process.exit(1)
}

console.log('[changeset-frontmatter] check passed (.changeset)')
