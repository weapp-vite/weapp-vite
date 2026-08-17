import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const RELEASE_BRANCHES = new Set(['main', 'alpha', 'beta', 'rc', 'next'])
const PRERELEASE_BRANCHES = new Set(['alpha', 'beta', 'rc', 'next'])

export interface ReleaseTriggerContext {
  eventName: 'push' | 'workflow_dispatch' | string
  branch: string
  pendingChangesetFiles: string[]
  changedFiles: string[]
  commitMessage?: string
}

function normalizePath(file: string) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '')
}

export function hasPendingChangeset(files: string[]) {
  return files.some((file) => {
    const normalized = normalizePath(file)
    return normalized.startsWith('.changeset/')
      && normalized.endsWith('.md')
      && !normalized.endsWith('/README.md')
  })
}

export function isReleaseCommitMessage(message = '') {
  const subject = message.trim().split(/\r?\n/, 1)[0] ?? ''
  return /^chore\(release\):\s*.+/i.test(subject)
    || /^version packages(?:\s|$)/i.test(subject)
}

export function hasReleaseArtifactPair(files: string[]) {
  const artifactsByDirectory = new Map<string, Set<string>>()

  for (const file of files) {
    const normalized = normalizePath(file)
    const slashIndex = normalized.lastIndexOf('/')
    if (slashIndex < 1) {
      continue
    }

    const directory = normalized.slice(0, slashIndex)
    const basename = normalized.slice(slashIndex + 1)
    if (basename !== 'package.json' && basename !== 'CHANGELOG.md') {
      continue
    }

    const artifacts = artifactsByDirectory.get(directory) ?? new Set<string>()
    artifacts.add(basename)
    artifactsByDirectory.set(directory, artifacts)
  }

  return [...artifactsByDirectory.values()].some(artifacts =>
    artifacts.has('package.json') && artifacts.has('CHANGELOG.md'))
}

export function shouldRunRelease(context: ReleaseTriggerContext) {
  if (context.eventName === 'workflow_dispatch') {
    return true
  }

  if (context.eventName !== 'push' || !RELEASE_BRANCHES.has(context.branch)) {
    return false
  }

  const pendingIntent = hasPendingChangeset(context.pendingChangesetFiles)
  if (pendingIntent) {
    return true
  }

  if (PRERELEASE_BRANCHES.has(context.branch)) {
    return false
  }

  return isReleaseCommitMessage(context.commitMessage)
    || hasReleaseArtifactPair(context.changedFiles)
}

async function readPendingChangesetFiles() {
  try {
    const entries = await fs.readdir('.changeset', { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
      .map(entry => `.changeset/${entry.name}`)
  }
  catch {
    return []
  }
}

async function readGitOutput(args: string[]) {
  try {
    const result = await execFileAsync('git', args, { encoding: 'utf8' })
    return result.stdout.trim()
  }
  catch {
    return ''
  }
}

async function readChangedFiles() {
  const eventPath = process.env.GITHUB_EVENT_NAME === 'push'
    ? process.env.GITHUB_EVENT_PATH
    : undefined
  let diffRange: string[] = []

  if (eventPath) {
    try {
      const event = JSON.parse(await fs.readFile(eventPath, 'utf8')) as { before?: string, after?: string }
      if (event.before && event.after && !/^0+$/.test(event.before)) {
        diffRange = [event.before, event.after]
      }
    }
    catch {
      // Fall back to the latest commit when event metadata is unavailable.
    }
  }

  const args = diffRange.length > 0
    ? ['diff', '--name-only', ...diffRange]
    : ['diff', '--name-only', 'HEAD^', 'HEAD']
  const output = await readGitOutput(args)
  return output ? output.split(/\r?\n/).filter(Boolean) : []
}

async function main() {
  const context: ReleaseTriggerContext = {
    eventName: process.env.GITHUB_EVENT_NAME ?? 'push',
    branch: process.env.GITHUB_REF_NAME ?? '',
    pendingChangesetFiles: await readPendingChangesetFiles(),
    changedFiles: await readChangedFiles(),
    commitMessage: await readGitOutput(['log', '-1', '--format=%s', process.env.GITHUB_SHA ?? 'HEAD']),
  }
  const shouldRun = shouldRunRelease(context)
  const output = `should_run=${shouldRun}`

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `${output}\n`)
  }
  console.log(JSON.stringify({ ...context, shouldRun }))
}

if (process.argv[1]?.endsWith('release-trigger.ts')) {
  await main()
}
