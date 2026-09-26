import type { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
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
  const hooks: string[] = []
  const visible = new Set<string>()
  const sleep = vi.fn(async (_milliseconds: number) => {})
  const github = { ensurePullRequest: vi.fn(), ensureTag: vi.fn(), ensureRelease: vi.fn() }
  let onPublish = (_args: string[], _attempt: number) => ({ status: 0, stdout: '', stderr: '' })
  // 记录每个 hook 调用时可观察到的 registry 状态。
  const hookVisibility: string[][] = []
  const spawn = ((command: string, args: string[]) => {
    if (command === 'npm' && args[0] === 'view') {
      const pkg = packages.find(pkg => `${pkg.name}@${pkg.version}` === args[1])
      return { status: pkg && visible.has(pkg.name) ? 0 : 1, stdout: pkg && visible.has(pkg.name) ? `${pkg.version}\n` : '', stderr: '' }
    }
    if (command === 'pnpm' && args[0] === 'publish') {
      publishes.push(args)
      return onPublish(args, publishes.length)
    }
    if (command === 'pnpm' && args[0] === 'run') {
      hooks.push(args[1])
      hookVisibility.push([...visible])
      return { status: 0, stdout: '', stderr: '' }
    }
    throw new Error(`Unexpected release command: ${command} ${args.join(' ')}`)
  }) as typeof spawnSync
  const options = {
    cwd,
    branch: 'main',
    env: { ...process.env, GITHUB_SHA: 'a'.repeat(40) },
    config: {
      qualityScripts: ['quality'],
      hooks: { beforePublish: ['before'], afterPublish: [{ script: 'after' }] },
    },
    spawn,
    sleep,
  }
  return {
    cwd,
    publishes,
    visible,
    sleep,
    hooks,
    hookVisibility,
    github,
    setPublish(handler: typeof onPublish) { onPublish = handler },
    summary(entries = packages) {
      writeFileSync(path.join(cwd, 'pnpm-publish-summary.json'), JSON.stringify({ publishedPackages: entries }))
    },
    async readSummary() {
      return JSON.parse(await readFile(path.join(cwd, 'pnpm-publish-summary.json'), 'utf8')) as { publishedPackages: PublishedPackage[] }
    },
    async progress() {
      return JSON.parse(await readFile(path.join(cwd, 'repoctl-publish-progress.json'), 'utf8')) as PublishProgress
    },
    run: () => publishStable(options),
    runCi: () => releaseCi({ ...options, mode: 'publish', github }),
  }
}
