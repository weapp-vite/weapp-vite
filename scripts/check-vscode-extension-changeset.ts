import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { collectChangesetPackages, hasReleaseArtifactsForPackage } from './changeset-utils'

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

function isReleaseWorthyVscodeFile(file: string) {
  return [
    'extensions/vscode/assets/',
    'extensions/vscode/extension/',
    'extensions/vscode/snippets/',
    'extensions/vscode/syntaxes/',
    'extensions/vscode/types/',
  ].some(prefix => file.startsWith(prefix))
  || [
    'extensions/vscode/extension.ts',
    'extensions/vscode/package.json',
    'extensions/vscode/tsconfig.json',
    'extensions/vscode/tsdown.config.mts',
  ].includes(file)
}

async function main() {
  const baseRef = resolveBaseRef()
  const changedVscodeFiles = getDiffFiles(baseRef, 'extensions/vscode')
  const changedChangesetFiles = getDiffFiles(baseRef, '.changeset')
    .filter(file => file.endsWith('.md') && path.basename(file) !== 'README.md')

  const hasReleaseWorthyVscodeChange = changedVscodeFiles.some(isReleaseWorthyVscodeFile)
  if (!hasReleaseWorthyVscodeChange) {
    return
  }

  const changesetPackages = await collectChangesetPackages(changedChangesetFiles.map(file => path.resolve(file)))
  const hasVscodeRelease = changesetPackages.has('@weapp-vite/vscode')
    || hasReleaseArtifactsForPackage(changedVscodeFiles, 'extensions/vscode')

  if (!hasVscodeRelease) {
    console.error('Missing changeset for @weapp-vite/vscode. Add a changeset when releasable files under extensions/vscode change.')
    process.exitCode = 1
  }
}

await main()
