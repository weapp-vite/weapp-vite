import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { FixtureLifecycle } from './verification/fixtureLifecycle'
import { readWorkflowFixture } from './workflowFixture.mjs'

const temporaryDirectories: string[] = []
const fixtureLifecycles = new Set<FixtureLifecycle>()
const helper = fileURLToPath(new URL('../.github/scripts/release-stage.sh', import.meta.url))
const timeoutResolver = fileURLToPath(new URL('../.github/scripts/release-timeout.sh', import.meta.url))

afterEach(async () => {
  await Promise.all([...fixtureLifecycles].map(lifecycle => lifecycle.close()))
  fixtureLifecycles.clear()
  await Promise.all(temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

async function createDeadlineFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release-deadline-'))
  temporaryDirectories.push(directory)
  const trace = path.join(directory, 'timeout.args')
  await fs.writeFile(path.join(directory, 'date'), '#!/bin/sh\nprintf "%s\\n" "$FIXTURE_NOW"\n', { mode: 0o755 })
  await fs.writeFile(path.join(directory, 'timeout'), `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  printf '%s\\n' 'timeout (GNU coreutils) fixture'
  exit 0
fi
printf '%s\\0' "$@" > "$FIXTURE_TRACE"
if [ "\${FIXTURE_EXECUTE:-0}" = 1 ]; then
  shift 3
  exec "$@"
fi
exit "\${FIXTURE_EXIT_CODE:-0}"
`, { mode: 0o755 })
  return {
    trace,
    directory,
    run(stage: string, now: number, deadline: string = '1100', exitCode = '0', execute = false) {
      const result = spawnSync('bash', [helper, stage], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          FIXTURE_NOW: String(now),
          FIXTURE_TRACE: trace,
          FIXTURE_EXIT_CODE: exitCode,
          FIXTURE_EXECUTE: execute ? '1' : '0',
          REPOCTL_RELEASE_DEADLINE_EPOCH: deadline,
        },
      })
      return { exitCode: result.status, stderr: result.stderr }
    },
  }
}

function withDeadlineFixture<T>(signal: AbortSignal, work: (fixture: Awaited<ReturnType<typeof createDeadlineFixture>>) => Promise<T>) {
  const lifecycle = new FixtureLifecycle(signal)
  fixtureLifecycles.add(lifecycle)
  return lifecycle.run(async () => work(await createDeadlineFixture()))
}

async function createTimeoutFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release timeout resolver-'))
  temporaryDirectories.push(directory)
  async function setCommand(command: 'timeout' | 'gtimeout' | 'gnutimeout', version: string, exitCode = 0) {
    await fs.writeFile(path.join(directory, command), `#!/bin/sh
if [ "\${1:-}" != "--version" ]; then
  exit 19
fi
printf '%s\\n' '${version}'
exit ${exitCode}
`, { mode: 0o755 })
  }
  for (const command of ['timeout', 'gtimeout', 'gnutimeout'] as const) {
    await setCommand(command, 'timeout (uutils coreutils) fixture')
  }
  return {
    directory,
    setCommand,
    run() {
      const result = spawnSync('bash', [timeoutResolver], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}` },
      })
      return { ...result, selected: result.stdout.trim() }
    },
  }
}

async function readTimeoutArgs(trace: string) {
  return (await fs.readFile(trace, 'utf8')).split('\0').slice(0, -1)
}

describe.skipIf(process.platform === 'win32')('Ubuntu release stage deadline', () => {
  it('uses the remaining shared budget for later stages and reserves forced termination time', ({ signal }) => withDeadlineFixture(signal, async (fixture) => {
    expect((await fixture.run('verify', 1000)).exitCode).toBe(0)
    const initialArgs = await readTimeoutArgs(fixture.trace)
    expect(initialArgs.slice(0, 5)).toEqual([
      '--signal=TERM',
      '--kill-after=5s',
      '95s',
      'bash',
      '-c',
    ])
    expect(initialArgs.slice(-2)).toEqual(['release-stage', 'verify'])
    expect((await fixture.run('prepare', 1050)).exitCode).toBe(0)
    const args = await readTimeoutArgs(fixture.trace)
    expect(args[2]).toBe('45s')
    expect(args.at(-1)).toBe('prepare')
    expect(args).not.toContain('--foreground')
  }), 30_000)

  it.each([1095, 1100, 1105])('does not start a release process when the remaining budget cannot cover teardown at %s', async (now) => {
    const fixture = await createDeadlineFixture()
    const result = await fixture.run('upload', now)
    expect(result.exitCode).toBe(124)
    expect(result.stderr).toContain('budget exhausted before upload')
    await expect(fs.stat(fixture.trace)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('propagates timeout failures to stop subsequent workflow stages', async () => {
    const fixture = await createDeadlineFixture()
    expect((await fixture.run('confirm', 1000, '1100', '124')).exitCode).toBe(124)
  })

  it('starts publication with a full budget after quality finishes near its deadline', async () => {
    const fixture = await createDeadlineFixture()
    const workflow = readWorkflowFixture('release.yml') as { jobs: { release: { env: Record<string, string>, steps: { name: string, run?: string }[] } } }
    const job = workflow.jobs.release
    const environment = path.join(fixture.directory, 'github.env')
    async function start(name: string, now: number) {
      const command = job.steps.find(step => step.name === name)!.run!
      const result = spawnSync('bash', ['-euc', command], {
        encoding: 'utf8',
        env: { ...process.env, ...job.env, PATH: `${fixture.directory}${path.delimiter}${process.env.PATH}`, FIXTURE_NOW: String(now), GITHUB_ENV: environment },
      })
      expect(result.status, result.stderr).toBe(0)
      return (await fs.readFile(environment, 'utf8')).trim().split('\n').at(-1)!.split('=')[1]!
    }
    const qualityDeadline = await start('Start quality deadline', 1000)
    expect(qualityDeadline).toBe('3700')
    expect(fixture.run('preflight', 3600, qualityDeadline).exitCode).toBe(0)
    expect(fixture.run('verify', 3690, qualityDeadline).exitCode).toBe(0)
    expect((await readTimeoutArgs(fixture.trace))[2]).toBe('5s')
    const publishDeadline = await start('Start publication deadline', 3695)
    expect(publishDeadline).toBe('6395')
    for (const [stage, now, remaining] of [['prepare', 3695, '2695s'], ['upload', 3795, '2595s'], ['confirm', 4300, '2090s'], ['finalize', 6000, '390s']] as const) {
      expect(fixture.run(stage, now, publishDeadline).exitCode).toBe(0)
      expect((await readTimeoutArgs(fixture.trace))[2]).toBe(remaining)
    }
  })

  it.each([0, 17])('preserves the real release command exit status %s through the supervisor', async (exitCode) => {
    const fixture = await createDeadlineFixture()
    await fs.writeFile(path.join(fixture.directory, 'pnpm'), '#!/bin/sh\nexit "$FIXTURE_EXIT_CODE"\n', { mode: 0o755 })
    expect(fixture.run('verify', 1000, '1100', String(exitCode), true).exitCode).toBe(exitCode)
  })

  it.each([
    { stage: 'publish', deadline: '1100' },
    { stage: 'verify', deadline: 'invalid' },
  ])('rejects invalid release inputs before launch: $stage / $deadline', async ({ stage, deadline }) => {
    const fixture = await createDeadlineFixture()
    expect((await fixture.run(stage, 1000, deadline)).exitCode).toBe(2)
    await expect(fs.stat(fixture.trace)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['timeout', 'gtimeout', 'gnutimeout'] as const)('selects GNU %s with the default implementation and fallback priority verified', async (command) => {
    const fixture = await createTimeoutFixture()
    await fixture.setCommand(command, 'timeout (GNU coreutils) fixture')
    await fixture.setCommand('gnutimeout', 'timeout (GNU coreutils) fixture')
    const result = fixture.run()
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.selected).toBe(path.join(fixture.directory, command))
  })

  it('rejects a version probe that exits unsuccessfully', async () => {
    const fixture = await createTimeoutFixture()
    await fixture.setCommand('timeout', 'timeout (GNU coreutils) fixture', 17)
    const result = fixture.run()
    expect(result.status).toBe(2)
    expect(result.selected).toBe('')
    expect(result.stderr).toContain('GNU timeout is required')
  })

  it('fails before selecting an implementation without the required identity', async () => {
    const fixture = await createTimeoutFixture()
    const result = fixture.run()
    expect(result.status).toBe(2)
    expect(result.selected).toBe('')
    expect(result.stderr).toContain('GNU timeout is required')
  })
})
