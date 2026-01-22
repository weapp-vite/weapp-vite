import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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

async function main() {
  const baseRef = resolveBaseRef()
  const changedFiles = getDiffFiles(baseRef)
  const changedChangesetFiles = getDiffFiles(baseRef, '.changeset')
    .filter(file => file.endsWith('.md') && path.basename(file) !== 'README.md')

  const changesetPackages = new Set<string>()
  for (const file of changedChangesetFiles) {
    const content = await fs.readFile(path.resolve(file), 'utf8')
    for (const pkg of extractChangesetPackages(content)) {
      changesetPackages.add(pkg)
    }
  }

  const templatesChanged = changedFiles.some(file => file.startsWith('templates/'))
  const releasingWeappVite = changesetPackages.has('weapp-vite')
  const releasingWevu = changesetPackages.has('wevu')
  const needsCreateWeappVite = templatesChanged || releasingWeappVite || releasingWevu
  const hasCreateWeappVite = changesetPackages.has('create-weapp-vite')

  if (needsCreateWeappVite && !hasCreateWeappVite) {
    const reasons = []
    if (templatesChanged) {
      reasons.push('templates changed')
    }
    if (releasingWeappVite) {
      reasons.push('weapp-vite release')
    }
    if (releasingWevu) {
      reasons.push('wevu release')
    }
    const reasonText = reasons.length ? ` (${reasons.join(', ')})` : ''
    const message = `Missing changeset for create-weapp-vite${reasonText}. Add a changeset that bumps "create-weapp-vite" to keep templates and deps in sync.`
    console.error(message)
    process.exitCode = 1
  }
}

await main()
