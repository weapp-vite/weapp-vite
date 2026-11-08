import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { FixtureLifecycle } from './verification/fixtureLifecycle'

const helper = fileURLToPath(new URL('../.github/scripts/prepare-release-timeout.sh', import.meta.url))
interface TimeoutFixtureRecord {
  lifecycle: FixtureLifecycle
  root?: string
}

const fixtures = new Set<TimeoutFixtureRecord>()
const gnuVersion = 'timeout (GNU coreutils) fixture'
const uutilsVersion = 'timeout (uutils coreutils) fixture'
type TimeoutCommand = 'timeout' | 'gtimeout' | 'gnutimeout'

afterEach(async () => {
  const active = [...fixtures]
  await Promise.all(active.map(fixture => fixture.lifecycle.close()))
  await Promise.all(active.map(async (fixture) => {
    if (fixture.root) {
      await fs.rm(fixture.root, { recursive: true, force: true })
    }
    fixtures.delete(fixture)
  }))
})

function resolveCommand(command: string) {
  const result = spawnSync('bash', ['-c', 'type -P -- "$1"', 'bash', command], { encoding: 'utf8' })
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Shell fixture requires ${command}`)
  }
  return result.stdout.trim()
}

function historicalTimeoutProbe(bash: string, env: NodeJS.ProcessEnv, cwd: string) {
  // 原恢复源码仅识别这两个命令；保持其成功退出与 GNU 身份双重判断。
  for (const command of ['timeout', 'gtimeout']) {
    const version = spawnSync(command, ['--version'], { encoding: 'utf8', env, cwd })
    if (version.status === 0 && version.stdout.includes('GNU coreutils')) {
      const resolved = spawnSync(bash, ['-c', 'command -v "$1"', 'bash', command], { encoding: 'utf8', env, cwd })
      if (resolved.status === 0) {
        return resolved.stdout.trim()
      }
    }
  }
}

async function createTimeoutFixture(record: TimeoutFixtureRecord, relativePath: boolean) {
  record.root = await fs.mkdtemp(path.join(os.tmpdir(), 'release timeout compatibility '))
  const root = await fs.realpath(record.root)
  record.root = root
  const bin = path.join(root, 'installed tools')
  const runnerTemp = path.join(root, 'runner temp')
  await fs.mkdir(bin)
  await fs.mkdir(runnerTemp)
  const bash = resolveCommand('bash')
  for (const command of ['mktemp', 'ln']) {
    await fs.symlink(resolveCommand(command), path.join(bin, command))
  }
  const githubPath = path.join(root, 'github path')
  const previousPath = `${path.join(root, 'existing task bin')}\n`
  await fs.writeFile(githubPath, previousPath)
  const trace = path.join(root, 'timeout args')
  const env = {
    ...process.env,
    PATH: relativePath ? path.relative(root, bin) : bin,
    RUNNER_TEMP: runnerTemp,
    GITHUB_PATH: githubPath,
    FIXTURE_TIMEOUT_ARGS: trace,
  }
  async function setCommand(command: TimeoutCommand, gnu: boolean, exitCode = 0) {
    const version = gnu ? gnuVersion : uutilsVersion
    await fs.writeFile(path.join(bin, command), `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  printf '%s\\n' '${version}'
  exit ${exitCode}
fi
printf '%s\\0' "$@" > "$FIXTURE_TIMEOUT_ARGS"
`, { mode: 0o755 })
  }
  for (const command of ['timeout', 'gtimeout', 'gnutimeout'] as const) {
    await setCommand(command, false)
  }
  return {
    root,
    bin,
    runnerTemp,
    githubPath,
    previousPath,
    trace,
    env,
    bash,
    setCommand,
    run: () => spawnSync(bash, [helper], { cwd: root, encoding: 'utf8', env }),
  }
}

function withTimeoutFixture<T>(signal: AbortSignal, work: (fixture: Awaited<ReturnType<typeof createTimeoutFixture>>) => Promise<T>, relativePath = false) {
  const record = { lifecycle: new FixtureLifecycle(signal) }
  fixtures.add(record)
  return record.lifecycle.run(async () => work(await createTimeoutFixture(record, relativePath)))
}

describe.skipIf(process.platform === 'win32')('task-scoped GNU timeout compatibility', () => {
  it('makes the historical timeout/gtimeout probe work when only gnutimeout is GNU, including paths with spaces', ({ signal }) => withTimeoutFixture(signal, async (fixture) => {
    const originalPath = process.env.PATH
    await fixture.setCommand('gnutimeout', true)
    expect(historicalTimeoutProbe(fixture.bash, fixture.env, fixture.root)).toBeUndefined()

    const prepared = fixture.run()
    expect(prepared.status, prepared.stderr).toBe(0)
    expect(prepared.stdout).toContain(path.join(fixture.bin, 'gnutimeout'))
    expect(prepared.stdout).toContain(gnuVersion)
    const entries = (await fs.readFile(fixture.githubPath, 'utf8')).trimEnd().split('\n')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toBe(fixture.previousPath.trimEnd())
    const taskBin = entries[1]!
    expect(path.dirname(taskBin)).toBe(fixture.runnerTemp)
    const linkedTimeout = path.join(taskBin, 'timeout')
    expect((await fs.lstat(linkedTimeout)).isSymbolicLink()).toBe(true)
    expect(await fs.readlink(linkedTimeout)).toBe(path.join(fixture.bin, 'gnutimeout'))
    const inherited = { ...fixture.env, PATH: `${taskBin}${path.delimiter}${fixture.env.PATH}` }
    expect(historicalTimeoutProbe(fixture.bash, inherited, fixture.root)).toBe(linkedTimeout)
    const executed = spawnSync('timeout', ['--signal=TERM', '--kill-after=5s', '9s', 'fixture-command'], { cwd: fixture.root, encoding: 'utf8', env: inherited })
    expect(executed.status, executed.stderr).toBe(0)
    expect((await fs.readFile(fixture.trace, 'utf8')).split('\0').slice(0, -1)).toEqual(['--signal=TERM', '--kill-after=5s', '9s', 'fixture-command'])
    expect(process.env.PATH).toBe(originalPath)
  }), 30_000)

  for (const command of ['timeout', 'gtimeout'] as const) {
    it(`retains the strict resolver preference for GNU ${command}`, ({ signal }) => withTimeoutFixture(signal, async (fixture) => {
      await fixture.setCommand(command, true)
      await fixture.setCommand('gnutimeout', true)
      const prepared = fixture.run()
      expect(prepared.status, prepared.stderr).toBe(0)
      const taskBin = (await fs.readFile(fixture.githubPath, 'utf8')).trimEnd().split('\n').at(-1)!
      expect(await fs.readlink(path.join(taskBin, 'timeout'))).toBe(path.join(fixture.bin, command))
    }))
  }

  it('uses an absolute symlink target when the selected GNU command came from a relative PATH entry', ({ signal }) => withTimeoutFixture(signal, async (fixture) => {
    await fixture.setCommand('gnutimeout', true)
    const prepared = fixture.run()
    expect(prepared.status, prepared.stderr).toBe(0)
    const taskBin = (await fs.readFile(fixture.githubPath, 'utf8')).trimEnd().split('\n').at(-1)!
    expect(await fs.readlink(path.join(taskBin, 'timeout'))).toBe(path.join(fixture.bin, 'gnutimeout'))
    expect(historicalTimeoutProbe(fixture.bash, { ...fixture.env, PATH: `${taskBin}${path.delimiter}${fixture.env.PATH}` }, fixture.root)).toBe(path.join(taskBin, 'timeout'))
  }, true))

  for (const failedProbe of [false, true]) {
    it(`rejects unavailable GNU timeout without changing GITHUB_PATH (unsuccessful version probe: ${failedProbe})`, ({ signal }) => withTimeoutFixture(signal, async (fixture) => {
      if (failedProbe) {
        await fixture.setCommand('gnutimeout', true, 17)
      }
      const prepared = fixture.run()
      expect(prepared.status).toBe(2)
      expect(prepared.stderr).toContain('GNU timeout is required')
      expect(await fs.readFile(fixture.githubPath, 'utf8')).toBe(fixture.previousPath)
      expect(await fs.readdir(fixture.runnerTemp)).toEqual([])
      expect(historicalTimeoutProbe(fixture.bash, fixture.env, fixture.root)).toBeUndefined()
    }))
  }
})
