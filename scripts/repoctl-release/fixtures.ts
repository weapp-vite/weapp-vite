import type { spawnSync } from 'node:child_process'
import type { ReleaseCiOptions, ReleaseCiStage, ReleaseCiStageResult, ReleaseStateSnapshot } from 'repoctl'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { publishStable, releaseCi } from 'repoctl'
import { vi } from 'vitest'

interface PublishedPackage {
  name: string
  version: string
}

interface PublishProgress {
  schemaVersion: number
  status: 'publishing' | 'confirming' | 'complete' | 'failed'
  candidates: PublishedPackage[]
  acceptedPackages: PublishedPackage[]
  confirmedPackages: PublishedPackage[]
}

const roots: string[] = []
export const packages = [
  { name: '@release-fixture/first', version: '1.0.0' },
  { name: '@release-fixture/second', version: '2.0.0' },
]

export async function cleanupReleaseFixtures() {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
}

export async function createReleaseFixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'repoctl-publish-'))
  roots.push(cwd)
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ private: true }))
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  for (const [index, pkg] of packages.entries()) {
    const directory = path.join(cwd, 'packages', String(index))
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'package.json'), JSON.stringify(pkg))
  }
  const publishes: string[][] = []
  const registryQueries: PublishedPackage[] = []
  const hooks: string[] = []
  const visible = new Set<string>()
  const sleep = vi.fn(async (_milliseconds: number) => {})
  const github = { ensurePullRequest: vi.fn(), ensureTag: vi.fn(), ensureRelease: vi.fn() }
  let onPublish = (_args: string[], _attempt: number) => ({ status: 0, stdout: '', stderr: '' })
  let onRegistry = (pkg: PublishedPackage | undefined, metadata = false) => {
    const published = pkg != null && visible.has(pkg.name)
    const stdout = published ? metadata ? JSON.stringify({ 'version': pkg.version, 'dist-tags': { latest: pkg.version } }) : `${pkg.version}\n` : ''
    return { status: published ? 0 : 1, stdout, stderr: published ? '' : 'npm error code E404\nnpm error 404 No match found for version' }
  }
  // 记录每个 hook 调用时可观察到的 registry 状态。
  const hookVisibility: string[][] = []
  let source = 'a'.repeat(40)
  let diff = ''
  let failingHook: string | undefined
  const spawn = ((command: string, args: string[]) => {
    if (command === 'git') {
      let stdout = args.join(' ') === 'rev-parse --git-dir' ? '.git' : args[0] === 'rev-parse' || args[0] === 'log' ? source : args[0] === 'diff' ? diff : ''
      if (args.join(' ') === 'rev-parse --is-shallow-repository') {
        stdout = 'false'
      }
      if (args[0] === 'ls-tree' && args.at(-1)?.endsWith('package.json')) {
        stdout = args.at(-1)!
      }
      if (args[0] === 'show') {
        stdout = readFileSync(path.join(cwd, args[1].split(':').slice(1).join(':')), 'utf8')
      }
      return { status: 0, stdout, stderr: '' }
    }
    if (command === 'npm' && args[0] === 'view') {
      const pkg = packages.find(pkg => `${pkg.name}@${pkg.version}` === args[1])
      if (pkg) {
        registryQueries.push(pkg)
      }
      return onRegistry(pkg, args.includes('--json'))
    }
    if (command === 'pnpm' && args[0] === 'publish') {
      publishes.push(args)
      return onPublish(args, publishes.length)
    }
    if (command === 'pnpm' && args[0] === 'run') {
      hooks.push(args[1])
      hookVisibility.push([...visible])
      if (args[1] === failingHook) {
        return { status: 1, stdout: '', stderr: 'fixture quality failure' }
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    throw new Error(`Unexpected release command: ${command} ${args.join(' ')}`)
  }) as typeof spawnSync
  const options = {
    cwd,
    branch: 'main',
    env: { ...process.env, GITHUB_SHA: 'a'.repeat(40), GITHUB_OUTPUT: undefined, GITHUB_STEP_SUMMARY: undefined },
    config: {
      qualityScripts: ['quality'],
      hooks: { beforePublish: ['before'], afterPublish: [{ script: 'after' }] },
    },
    spawn,
    sleep,
  }
  let checkpoint: ReleaseStateSnapshot | undefined
  const stagedGithub = {
    ...github,
    listReleases: vi.fn(async () => []),
    readReleaseState: vi.fn(async () => checkpoint),
    writeReleaseState: vi.fn(async (_key: string, state: ReleaseStateSnapshot['state']) => {
      const revision = String(Number(checkpoint?.revision ?? 0) + 1)
      checkpoint = { revision, state }
      return revision
    }),
  }
  return {
    cwd,
    publishes,
    registryQueries,
    visible,
    sleep,
    hooks,
    hookVisibility,
    github,
    setSource(value: string) { source = value },
    setDiff(value: string) { diff = value },
    failHook(value: string) { failingHook = value },
    setPublish(handler: typeof onPublish) { onPublish = handler },
    setRegistry(handler: typeof onRegistry) { onRegistry = handler },
    summary(entries = packages) {
      writeFileSync(path.join(cwd, 'pnpm-publish-summary.json'), JSON.stringify({ publishedPackages: entries }))
    },
    async readSummary() {
      return JSON.parse(await readFile(path.join(cwd, 'pnpm-publish-summary.json'), 'utf8')) as { publishedPackages: PublishedPackage[] }
    },
    async progress() {
      return JSON.parse(await readFile(path.join(cwd, 'repoctl-publish-progress.json'), 'utf8')) as PublishProgress
    },
    async stageProgress() {
      return JSON.parse(await readFile(path.join(cwd, 'repoctl-ci-progress.json'), 'utf8')) as ReleaseCiStageResult
    },
    runStage: (stage: ReleaseCiStage, overrides: Pick<ReleaseCiOptions, 'env' | 'config'> = {}) => releaseCi({
      ...options,
      ...overrides,
      env: { ...options.env, GITHUB_REPOSITORY: 'release-fixture/repository', GITHUB_RUN_ID: 'fixture-run', GITHUB_RUN_ATTEMPT: '1', ...overrides.env },
      mode: 'publish',
      github: stagedGithub,
      stage,
    }),
    run: () => publishStable(options),
    runCi: () => releaseCi({ ...options, mode: 'publish', github }),
  }
}
