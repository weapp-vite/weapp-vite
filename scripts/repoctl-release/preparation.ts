import type { spawnSync } from 'node:child_process'
import type { ReleaseCiStage } from 'repoctl'
import { writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createReleasePullRequest, prepareStable, releaseCi } from 'repoctl'
import { vi } from 'vitest'

interface Manifest {
  name: string
  version?: string
  private?: boolean
  packageManager?: string
  dependencies?: Record<string, string>
}

export interface AppliedVersion {
  name: string
  currentVersion: string
  newVersion: string
}

const roots: string[] = []
export const publicName = '@release-fixture/library'
export const privateName = '@release-fixture/demo'
export const rootName = '@release-fixture/root'

export async function cleanupPreparationFixtures() {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
}

export async function createPreparationFixture() {
  // 使用真实路径，避免 macOS 的临时目录别名让根包过滤行为与 Linux 不一致。
  const cwd = await realpath(await mkdtemp(path.join(tmpdir(), 'repoctl-prepare-')))
  roots.push(cwd)
  const manifests: Record<string, Manifest> = {
    'package.json': { name: rootName, private: true, version: '1.0.0', packageManager: 'pnpm@12.9.1' },
    'packages/library/package.json': { name: publicName, version: '1.0.0' },
    'packages/demo/package.json': {
      name: privateName,
      private: true,
      version: '1.0.0',
      dependencies: { [publicName]: 'workspace:*' },
    },
    'packages/tool/package.json': { name: '@release-fixture/tool', private: true },
  }
  for (const [file, manifest] of Object.entries(manifests)) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
    await writeFile(path.join(cwd, file), JSON.stringify(manifest))
  }
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  await mkdir(path.join(cwd, '.changeset'))
  await writeFile(path.join(cwd, '.changeset/update.md'), `---\n"${publicName}": patch\n"${privateName}": patch\n"${rootName}": patch\n---\n\n发布测试。\n`)
  const hooks: string[] = []
  const versionCalls: string[][] = []
  const gitCommands: string[][] = []
  const github = { ensurePullRequest: vi.fn(), ensureTag: vi.fn(), ensureRelease: vi.fn() }
  const stagedGithub = {
    ...github,
    readReleaseState: vi.fn(async () => undefined),
    writeReleaseState: vi.fn(async () => 'fixture-revision'),
  }
  let version = () => ({ status: 0, stdout: '[]', stderr: '' })
  const spawn = ((command: string, args: string[]) => {
    if (command === 'pnpm' && args[0] === 'version') {
      versionCalls.push(args)
      return version()
    }
    if (command === 'pnpm' && args[0] === 'run') {
      hooks.push(args[1])
      return { status: 0, stdout: '', stderr: '' }
    }
    if (command === 'git' && args.join(' ') === 'diff --quiet --exit-code') {
      return { status: 1, stdout: '', stderr: '' }
    }
    if (command === 'git') {
      gitCommands.push(args)
      if (args.join(' ') === 'rev-parse --git-dir') {
        return { status: 0, stdout: '.git', stderr: '' }
      }
      if (args.join(' ') === 'rev-parse HEAD') {
        return { status: 0, stdout: 'a'.repeat(40), stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    throw new Error(`Unexpected preparation command: ${command} ${args.join(' ')}`)
  }) as typeof spawnSync
  return {
    cwd,
    hooks,
    versionCalls,
    gitCommands,
    github,
    runStage: (stage: ReleaseCiStage) => releaseCi({
      cwd,
      branch: 'main',
      mode: 'auto',
      stage,
      env: { GITHUB_REPOSITORY: 'release-fixture/repository', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: 'fixture-run', GITHUB_RUN_ATTEMPT: '1' },
      config: { qualityScripts: ['quality'], hooks: { beforeVersion: ['before-version'], afterVersion: ['after-version'] } },
      spawn,
      github: stagedGithub,
    }),
    apply(entries: AppliedVersion[]) {
      for (const entry of entries) {
        const match = Object.entries(manifests).find(([, manifest]) => manifest.name === entry.name)
        if (match) {
          writeFileSync(path.join(cwd, match[0]), JSON.stringify({ ...match[1], version: entry.newVersion }))
        }
      }
    },
    setVersion(handler: typeof version) { version = handler },
    async manifest(file: string) {
      return JSON.parse(await readFile(path.join(cwd, file), 'utf8')) as Manifest
    },
    run: () => prepareStable({
      cwd,
      branch: 'main',
      config: { qualityScripts: [], hooks: { afterVersion: ['after-version'] } },
      spawn,
    }),
    runPullRequest: () => createReleasePullRequest({
      cwd,
      branch: 'main',
      config: { qualityScripts: [], hooks: { afterVersion: ['after-version'] } },
      spawn,
      github,
    }),
  }
}

export function bump(name: string): AppliedVersion {
  return { name, currentVersion: '1.0.0', newVersion: '1.0.1' }
}
