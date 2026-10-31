import type { spawnSync, SpawnSyncOptions } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { releaseNightly } from 'repoctl'
import { afterEach, describe, expect, it, vi } from 'vitest'

const temporaryDirectories: string[] = []
const deadlineVariable = 'REPOCTL_NIGHTLY_QUALITY_DEADLINE_EPOCH'
const initialTime = Date.parse('2026-10-31T02:00:00Z')
const commit = 'a'.repeat(40)
const repository = 'nightly-fixture/repository'
const workflow = `${repository}/.github/workflows/release.yml@refs/heads/main`

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

interface QualityCall {
  script: string
  timeout: number | undefined
}

interface FixtureOptions {
  deadline?: string
  failScript?: string
  advanceAfterFirst?: number
}

async function createNightlyFixture(options: FixtureOptions = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'nightly-deadline-'))
  temporaryDirectories.push(directory)
  const source = path.join(await realpath(directory), 'source')
  const library = path.join(source, 'packages/library')
  await mkdir(library, { recursive: true })
  await Promise.all([
    writeFile(path.join(source, 'package.json'), JSON.stringify({ private: true, packageManager: 'pnpm@12.15.0' })),
    writeFile(path.join(source, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n'),
    writeFile(path.join(library, 'package.json'), JSON.stringify({ name: '@nightly-fixture/library', version: '1.0.0' })),
    writeFile(path.join(directory, 'event.json'), JSON.stringify({
      repository: { full_name: repository, default_branch: 'main' },
      inputs: { mode: 'nightly' },
    })),
  ])

  const clock = vi.spyOn(Date, 'now').mockReturnValue(initialTime)
  const qualityCalls: QualityCall[] = []
  const unexpectedCommands: string[][] = []
  const failScript = options.failScript ?? 'quality-second'
  const spawn = vi.fn((command: string, args: string[], settings: SpawnSyncOptions) => {
    let stdout = ''
    if (command === 'git') {
      if (args.join(' ') === 'rev-parse --show-toplevel') {
        stdout = source
      }
      else if (args.join(' ') === 'rev-parse HEAD') {
        stdout = commit
      }
      else if (args.join(' ') !== '--no-optional-locks status --porcelain --untracked-files=all') {
        unexpectedCommands.push([command, ...args])
        throw new Error(`Unexpected Git command: ${args.join(' ')}`)
      }
    }
    else if (command === 'pnpm' && args.includes('--version')) {
      stdout = '12.15.0'
    }
    else if (command === 'pnpm' && args.includes('--help')) {
      stdout = '--dry-run --json'
    }
    else if (command === 'pnpm' && args.includes('--dry-run')) {
      stdout = '[]'
    }
    else if (command === 'pnpm' && args[0] === 'run') {
      const script = args[1]!
      qualityCalls.push({ script, timeout: settings.timeout })
      if (script === 'quality-first' && options.advanceAfterFirst !== undefined) {
        clock.mockReturnValue(initialTime + options.advanceAfterFirst)
      }
      if (script === failScript) {
        return { status: 17, stdout: '', stderr: 'fixture quality failure' }
      }
    }
    else {
      unexpectedCommands.push([command, ...args])
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`)
    }
    return { status: 0, stdout, stderr: '' }
  })

  const identity = `header.${Buffer.from(JSON.stringify({
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'npm:registry.npmjs.org',
    repository,
    workflow_ref: workflow,
    runner_environment: 'github-hosted',
  })).toString('base64url')}.signature`
  const registryFetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.href.startsWith('https://oidc.example.test/identity')) {
      return Response.json({ value: identity })
    }
    if (url.pathname.startsWith('/-/npm/v1/oidc/token/exchange/package/')) {
      return Response.json({ token: 'fixture-exchange' }, { status: 201 })
    }
    if (url.pathname.endsWith('/dist-tags')) {
      return Response.json({ latest: '1.0.0' })
    }
    throw new Error(`Unexpected registry request: ${url.pathname}`)
  })

  return {
    qualityCalls,
    unexpectedCommands,
    run: () => releaseNightly({
      cwd: source,
      outputDirectory: path.join(directory, 'reports'),
      publish: true,
      config: {
        nightly: { provider: 'npm' },
        qualityScripts: ['quality-first', 'quality-second'],
        hooks: { verify: ['quality-hook'] },
      },
      env: {
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: repository,
        GITHUB_SHA: commit,
        GITHUB_REF: 'refs/heads/main',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: path.join(directory, 'event.json'),
        GITHUB_RUN_ID: '17',
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_WORKFLOW_REF: workflow,
        ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.example.test/identity',
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-request',
        REPOCTL_SNAPSHOT_PUBLISH: '1',
        ...(options.deadline !== undefined ? { [deadlineVariable]: options.deadline } : {}),
      },
      spawn: spawn as unknown as typeof spawnSync,
      registryFetch,
    }),
  }
}

describe('repoctl nightly quality deadline', () => {
  it('keeps the ten minute command timeout when no shared deadline is configured', async () => {
    const fixture = await createNightlyFixture()
    const report = await fixture.run()
    expect(report.error).toContain('fixture quality failure')
    expect(fixture.qualityCalls).toEqual([
      { script: 'quality-first', timeout: 600_000 },
      { script: 'quality-second', timeout: 600_000 },
    ])
    expect(fixture.unexpectedCommands).toEqual([])
  })

  it('uses one decreasing budget across quality scripts and verify hooks', async () => {
    const fixture = await createNightlyFixture({
      deadline: String(initialTime / 1000 + 45 * 60),
      advanceAfterFirst: 5 * 60_000,
      failScript: 'quality-hook',
    })
    const report = await fixture.run()
    expect(report.error).toContain('fixture quality failure')
    expect(fixture.qualityCalls).toEqual([
      { script: 'quality-first', timeout: 2_700_000 },
      { script: 'quality-second', timeout: 2_400_000 },
      { script: 'quality-hook', timeout: 2_400_000 },
    ])
    expect(fixture.unexpectedCommands).toEqual([])
  })

  it.each([
    ['expired', String(initialTime / 1000 - 1)],
    ['exhausted', String(initialTime / 1000)],
    ['empty', ''],
    ['whitespace', ' '],
    ['trailing newline', `${initialTime / 1000 + 2700}\n`],
    ['non-numeric', 'tomorrow'],
    ['zero', '0'],
    ['negative', '-1'],
    ['fractional', `${initialTime / 1000 + 0.5}`],
    ['unsafe integer', String(Number.MAX_SAFE_INTEGER + 1)],
  ])('rejects an %s deadline before starting quality commands', async (_kind, deadline) => {
    const fixture = await createNightlyFixture({ deadline })
    const report = await fixture.run()
    expect(report.status).toBe('failed')
    expect(report.error).toMatch(/deadline|budget/i)
    expect(fixture.qualityCalls).toEqual([])
    expect(fixture.unexpectedCommands).toEqual([])
    expect(report.snapshot?.status).toBe('planned')
    expect(report.confirmed).not.toBe(true)
  })

  it('does not start another quality command when the shared budget expires', async () => {
    const fixture = await createNightlyFixture({
      deadline: String(initialTime / 1000 + 45 * 60),
      advanceAfterFirst: 45 * 60_000,
    })
    const report = await fixture.run()
    expect(report.status).toBe('failed')
    expect(report.error).toMatch(/deadline|budget/i)
    expect(fixture.qualityCalls).toEqual([{ script: 'quality-first', timeout: 2_700_000 }])
    expect(fixture.unexpectedCommands).toEqual([])
  })

  it('stops quality, build and publication after a real quality command failure', async () => {
    const fixture = await createNightlyFixture({
      deadline: String(initialTime / 1000 + 45 * 60),
      failScript: 'quality-first',
    })
    const report = await fixture.run()
    expect(report.status).toBe('failed')
    expect(report.error).toContain('Nightly pnpm run quality-first failed: fixture quality failure')
    expect(fixture.qualityCalls).toEqual([{ script: 'quality-first', timeout: 2_700_000 }])
    expect(fixture.unexpectedCommands).toEqual([])
    expect(report.snapshot?.status).toBe('planned')
    expect(report.confirmed).not.toBe(true)
    expect(report.consumer).toBeUndefined()
  })
})
