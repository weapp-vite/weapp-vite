import type { DocsSiteConfig, ReleaseCiOptions, ReleaseCiStage, ReleaseLifecycleState, ReleaseStateSnapshot } from 'repoctl'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { releaseCi } from 'repoctl'
import { vi } from 'vitest'
import { FixtureLifecycle } from '../verification/fixtureLifecycle.ts'

const fixtures = new Set<{ lifecycle: FixtureLifecycle, root?: string }>()
export const releasedPackage = { name: '@release-source-fixture/library', version: '1.0.1' }
export const marketplaceHook = 'marketplace:publish'
export const mirrorHook = 'mirror:sync'

export async function cleanupSourceRecoveryFixtures() {
  const active = [...fixtures]
  await Promise.all(active.map(fixture => fixture.lifecycle.close()))
  await Promise.all(active.map(async (fixture) => {
    if (fixture.root) {
      await rm(fixture.root, { recursive: true, force: true })
    }
    fixtures.delete(fixture)
  }))
}

async function initializeFixture(record: { lifecycle: FixtureLifecycle, root?: string }, acknowledgeHooks: string) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'repoctl-source-recovery-')))
  record.root = root
  const cwd = path.join(root, 'main')
  await mkdir(path.join(cwd, 'packages/library'), { recursive: true })
  await mkdir(path.join(cwd, '.changeset'))
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } })
    if (result.status !== 0) {
      throw new Error(`Fixture git ${args[0]} failed: ${result.stderr}`)
    }
    return result.stdout.trim()
  }
  git('init', '-b', 'main')
  git('config', 'user.name', 'Release fixture')
  git('config', 'user.email', 'release-fixture@example.test')
  git('config', 'core.hooksPath', path.join(root, 'no-hooks'))
  git('config', 'commit.gpgsign', 'false')
  git('config', 'core.autocrlf', 'false')
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  const config = {
    qualityScripts: ['quality'],
    hooks: {
      beforePublish: ['before'],
      afterPublish: [
        { script: marketplaceHook },
        { script: mirrorHook, idempotent: true, continueOnError: true },
      ],
    },
  }
  const site: DocsSiteConfig = {
    packages: [releasedPackage.name],
    buildScript: 'docs:build',
    preview: { deployScript: 'docs:preview' },
    stable: { deployScript: 'docs:stable' },
    patchPaths: ['website/**'],
  }
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ private: true, packageManager: manifest.packageManager }))
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  await writeFile(path.join(cwd, 'repoctl.config.mjs'), `export default ${JSON.stringify({ commands: { release: config, docs: { sites: { website: site } } } })}\n`)
  const packageFile = path.join(cwd, 'packages/library/package.json')
  await writeFile(packageFile, JSON.stringify({ ...releasedPackage, version: '1.0.0' }))
  git('add', '.')
  git('commit', '-m', 'chore: initial fixture')
  await writeFile(packageFile, JSON.stringify(releasedPackage))
  await writeFile(path.join(cwd, 'packages/library/CHANGELOG.md'), '# Changelog\n\n## 1.0.1\n\n- Prepared release.\n')
  git('add', '.')
  git('commit', '-m', 'chore: prepare release')
  const sourceSha = git('rev-parse', 'HEAD')
  const intentFile = path.join(cwd, '.changeset/current.md')
  const intent = `---\n"${releasedPackage.name}": patch\n---\n\nA newer pending change.\n`
  await writeFile(intentFile, intent)
  git('add', '.')
  git('commit', '-m', 'fix: preserve newer pending intent')
  const mainSha = git('rev-parse', 'HEAD')
  git('remote', 'add', 'origin', 'https://example.test/release-fixture/repository.git')
  git('update-ref', 'refs/remotes/origin/main', mainSha)

  const tag = `${releasedPackage.name}@${releasedPackage.version}`
  let checkpoint: ReleaseStateSnapshot = {
    revision: '1',
    state: {
      schemaVersion: 1,
      writer: 'interrupted-fixture-run',
      repository: 'release-fixture/repository',
      candidates: [releasedPackage],
      packages: [{ ...releasedPackage, target: sourceSha }],
      accepted: [releasedPackage],
      uploadComplete: true,
      npm: 'complete',
      metadata: [tag],
      hooks: { [marketplaceHook]: 'running', [mirrorHook]: 'pending' },
      complete: false,
    },
  }
  const hooks: { script: string, cwd: string, head: string, source?: string }[] = []
  const publishes: string[][] = []
  const installs: string[] = []
  const toolchains: string[] = []
  const automation = new Map<string, { revision: string, value: unknown }>()
  const github = {
    ensurePullRequest: vi.fn(),
    ensureRelease: vi.fn(),
    ensureTag: vi.fn(async () => {}),
    listReleases: vi.fn(async () => [{ id: 1, html_url: 'https://example.test/release', tag_name: tag, target_commitish: sourceSha, draft: false, prerelease: false }]),
    readTagTarget: vi.fn(async () => sourceSha),
    readReleaseState: vi.fn(async () => structuredClone(checkpoint)),
    writeReleaseState: vi.fn(async (_key: string, state: ReleaseLifecycleState, revision?: string) => {
      if (revision !== checkpoint.revision) {
        throw new Error('Release checkpoint revision changed')
      }
      checkpoint = { revision: String(Number(checkpoint.revision) + 1), state: structuredClone(state) }
      return checkpoint.revision
    }),
    readAutomationState: vi.fn(async (key: string) => structuredClone(automation.get(key))),
    writeAutomationState: vi.fn(async (key: string, value: unknown) => {
      automation.set(key, { revision: '1', value: structuredClone(value) })
      return '1'
    }),
  }
  const spawn = ((command: string, args: string[], options: { cwd: string, env: NodeJS.ProcessEnv }) => {
    if (command === 'git') {
      return spawnSync(command, args, { ...options, encoding: 'utf8' })
    }
    if (command === 'corepack' && args[0] === 'enable') {
      toolchains.push(args[args.indexOf('--install-directory') + 1])
    }
    else if (command === 'pnpm' && args[0] === 'install') {
      installs.push(options.cwd)
    }
    else if (command === 'pnpm' && args[0] === 'run') {
      const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: options.cwd, encoding: 'utf8' })
      if (head.status !== 0) {
        throw new Error('Cannot read the hook checkout identity')
      }
      hooks.push({ script: args[1], cwd: options.cwd, head: head.stdout.trim(), source: options.env.REPO_RELEASE_SOURCE_SHA })
    }
    else if (command === 'pnpm' && args[0] === 'publish') {
      publishes.push(args)
      throw new Error('A completed npm checkpoint must never publish again')
    }
    else if (command === 'npm' && args[0] === 'view' && args[1] === tag) {
      return { status: 0, stdout: args.includes('--json') ? JSON.stringify({ 'version': releasedPackage.version, 'gitHead': sourceSha, 'dist-tags': { latest: releasedPackage.version } }) : `${releasedPackage.version}\n`, stderr: '' }
    }
    else {
      throw new Error(`Unexpected source recovery command: ${command} ${args.join(' ')}`)
    }
    return { status: 0, stdout: '', stderr: '' }
  }) as typeof spawnSync
  const output = path.join(root, 'github-output')
  const options: ReleaseCiOptions = {
    cwd,
    sourceSha,
    branch: 'main',
    mode: 'publish',
    config,
    github,
    spawn,
    env: {
      ...process.env,
      GITHUB_REPOSITORY: 'release-fixture/repository',
      GITHUB_SHA: mainSha,
      GITHUB_RUN_ID: 'source-recovery-fixture-run',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: undefined,
      REPO_RELEASE_ACKNOWLEDGE_HOOKS: acknowledgeHooks,
    },
  }
  return {
    cwd,
    sourceSha,
    mainSha,
    hooks,
    publishes,
    installs,
    toolchains,
    github,
    automation,
    checkpoint: () => structuredClone(checkpoint),
    intent: () => readFile(intentFile, 'utf8'),
    originalIntent: intent,
    output: () => readFile(output, 'utf8'),
    git,
    recoveryRoot: path.join(cwd, '.git/repoctl-release-ci/source'),
    runStage: (stage: ReleaseCiStage) => record.lifecycle.run(async () => {
      const result = await releaseCi({ ...options, stage })
      if (!result || !('done' in result)) {
        throw new Error(`Expected a receipt for release stage ${stage}`)
      }
      return result
    }),
  }
}

export function withSourceRecoveryFixture<T>(signal: AbortSignal, work: (fixture: Awaited<ReturnType<typeof initializeFixture>>) => Promise<T>, acknowledgeHooks = marketplaceHook): Promise<T> {
  const record = { lifecycle: new FixtureLifecycle(signal) }
  fixtures.add(record)
  return record.lifecycle.run(async () => work(await initializeFixture(record, acknowledgeHooks)))
}
