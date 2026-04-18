import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

interface WeappCorePackageEntry {
  dir: string
  name: string
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

async function collectWeappCorePackages() {
  const weappCoreRoot = path.resolve('@weapp-core')
  const entries = await fs.readdir(weappCoreRoot, { withFileTypes: true })
  const packages: WeappCorePackageEntry[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const dir = path.posix.join('@weapp-core', entry.name)
    const packageJsonPath = path.resolve(dir, 'package.json')
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content) as {
        name?: string
        private?: boolean
      }
      if (!packageJson.name || packageJson.private === true) {
        continue
      }
      packages.push({
        dir,
        name: packageJson.name,
      })
    }
    catch {
      continue
    }
  }

  return packages.sort((a, b) => a.dir.localeCompare(b.dir))
}

function isReleaseWorthyWeappCoreFile(file: string, packageDir: string) {
  return file.startsWith(`${packageDir}/src/`)
    || [
      `${packageDir}/package.json`,
      `${packageDir}/tsdown.config.ts`,
    ].includes(file)
}

async function main() {
  const baseRef = resolveBaseRef()
  const changedWeappCoreFiles = getDiffFiles(baseRef, '@weapp-core')
  if (changedWeappCoreFiles.length === 0) {
    return
  }

  const packages = await collectWeappCorePackages()
  const affectedPackages = packages
    .filter(pkg => changedWeappCoreFiles.some(file => isReleaseWorthyWeappCoreFile(file, pkg.dir)))
    .map(pkg => pkg.name)
    .sort()

  if (affectedPackages.length === 0) {
    return
  }

  const changedChangesetFiles = getDiffFiles(baseRef, '.changeset')
    .filter(file => file.endsWith('.md') && path.basename(file) !== 'README.md')

  const changesetPackages = new Set<string>()
  for (const file of changedChangesetFiles) {
    const content = await fs.readFile(path.resolve(file), 'utf8')
    for (const pkg of extractChangesetPackages(content)) {
      changesetPackages.add(pkg)
    }
  }

  const missing = affectedPackages.filter(pkg => !changesetPackages.has(pkg))
  if (missing.length === 0) {
    return
  }

  console.error([
    'Missing changeset for releasable @weapp-core packages.',
    `Affected packages: ${affectedPackages.join(', ')}`,
    `Missing in changesets: ${missing.join(', ')}`,
    'Add .changeset entries for every changed publishable package under @weapp-core/*.',
  ].join('\n'))
  process.exitCode = 1
}

await main()
