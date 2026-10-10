import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []
const helper = fileURLToPath(new URL('../.github/scripts/release-stage.sh', import.meta.url))

function findGnuTimeout() {
  if (process.platform === 'win32') {
    return undefined
  }
  for (const command of ['timeout', 'gtimeout']) {
    const version = spawnSync(command, ['--version'], { encoding: 'utf8' })
    if (version.status === 0 && version.stdout.includes('GNU coreutils')) {
      const resolved = spawnSync('bash', ['-c', 'command -v "$1"', 'bash', command], { encoding: 'utf8' })
      if (resolved.status === 0) {
        return resolved.stdout.trim()
      }
    }
  }
}

const gnuTimeout = findGnuTimeout()

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

async function createDeadlineFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release-deadline-'))
  temporaryDirectories.push(directory)
  const trace = path.join(directory, 'timeout.args')
  await fs.writeFile(path.join(directory, 'date'), '#!/bin/sh\nprintf "%s\\n" "$FIXTURE_NOW"\n', { mode: 0o755 })
  await fs.writeFile(path.join(directory, 'timeout'), `#!/bin/sh
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

async function readTimeoutArgs(trace: string) {
  return (await fs.readFile(trace, 'utf8')).split('\0').slice(0, -1)
}

interface ProcessRecord {
  pid: number
  role: 'supervisor' | 'command' | 'descendant'
}

async function readProcessRecords(evidence: string): Promise<ProcessRecord[]> {
  const content = await fs.readFile(evidence, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return ''
  })
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as ProcessRecord)
}

async function processState(pid: number, ownerToken: string) {
  if (process.platform === 'linux') {
    try {
      const [environment, stat] = await Promise.all([
        fs.readFile(`/proc/${pid}/environ`, 'utf8'),
        fs.readFile(`/proc/${pid}/stat`, 'utf8'),
      ])
      if (['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3))) {
        return 'zombie'
      }
      return environment.split('\0').includes(`FIXTURE_OWNER_TOKEN=${ownerToken}`) ? 'running' : 'foreign'
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      return 'gone'
    }
  }
  const result = spawnSync('ps', ['eww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
  if (result.status !== 0) {
    return 'gone'
  }
  return result.stdout.includes(`FIXTURE_OWNER_TOKEN=${ownerToken}`) ? 'running' : 'foreign'
}

async function waitForProcessExit(pid: number, ownerToken: string) {
  const deadline = Date.now() + 2000
  let state = await processState(pid, ownerToken)
  while (state === 'running' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
    state = await processState(pid, ownerToken)
  }
  return state
}

async function cleanupFixtureProcesses(evidence: string, ownerToken: string) {
  for (const { pid } of await readProcessRecords(evidence)) {
    if (await processState(pid, ownerToken) !== 'running') {
      continue
    }
    try {
      process.kill(pid, 'SIGKILL')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        throw error
      }
    }
    await waitForProcessExit(pid, ownerToken)
  }
}

describe.skipIf(process.platform === 'win32')('Ubuntu release stage deadline', () => {
  it('uses the remaining shared budget for later stages and reserves forced termination time', async () => {
    const fixture = await createDeadlineFixture()
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
  })

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

  it.skipIf(process.platform !== 'linux' && !gnuTimeout)('kills a TERM-ignoring descendant even when pnpm exits before the kill grace', async () => {
    expect(gnuTimeout, 'Ubuntu release CI requires GNU timeout for the process-group regression').toBeTypeOf('string')
    if (!gnuTimeout) {
      throw new Error('GNU timeout is required on Linux')
    }
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release-process-group-'))
    temporaryDirectories.push(directory)
    const evidence = path.join(directory, 'processes.jsonl')
    const ready = path.join(directory, 'descendant-ready')
    const terminated = path.join(directory, 'command-terminated')
    const ignored = path.join(directory, 'descendant-ignored-term')
    const ownerToken = path.basename(directory)
    await fs.symlink(gnuTimeout, path.join(directory, 'timeout'))
    await fs.writeFile(path.join(directory, 'date'), '#!/bin/sh\nprintf "1000\\n"\n', { mode: 0o755 })
    const descendantSource = `
const fs = require('node:fs')
process.on('SIGTERM', () => fs.writeFileSync(process.env.FIXTURE_IGNORED, 'TERM'))
fs.writeFileSync(process.env.FIXTURE_READY, 'ready')
setInterval(() => {}, 1000)
`
    await fs.writeFile(path.join(directory, 'pnpm'), `#!${process.execPath}
const fs = require('node:fs')
const { spawn } = require('node:child_process')
fs.appendFileSync(process.env.FIXTURE_EVIDENCE, JSON.stringify({ pid: process.ppid, role: 'supervisor' }) + '\\n')
fs.appendFileSync(process.env.FIXTURE_EVIDENCE, JSON.stringify({ pid: process.pid, role: 'command' }) + '\\n')
process.on('SIGTERM', () => {
  fs.writeFileSync(process.env.FIXTURE_TERMINATED, 'TERM')
  process.exit(0)
})
const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendantSource)}, process.env.FIXTURE_OWNER_TOKEN], { stdio: 'inherit' })
fs.appendFileSync(process.env.FIXTURE_EVIDENCE, JSON.stringify({ pid: child.pid, role: 'descendant' }) + '\\n')
setInterval(() => {}, 1000)
`, { mode: 0o755 })
    try {
      const result = spawnSync('bash', [helper, 'verify'], {
        stdio: 'ignore',
        timeout: 15000,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          FIXTURE_EVIDENCE: evidence,
          FIXTURE_READY: ready,
          FIXTURE_TERMINATED: terminated,
          FIXTURE_IGNORED: ignored,
          FIXTURE_OWNER_TOKEN: ownerToken,
          REPOCTL_RELEASE_DEADLINE_EPOCH: '1008',
        },
      })
      expect(result.error).toBeUndefined()
      expect(result.status).not.toBe(0)
      expect(await fs.readFile(ready, 'utf8')).toBe('ready')
      expect(await fs.readFile(terminated, 'utf8')).toBe('TERM')
      expect(await fs.readFile(ignored, 'utf8')).toBe('TERM')
      const records = await readProcessRecords(evidence)
      expect(records.map(record => record.role)).toEqual(['supervisor', 'command', 'descendant'])
      for (const { pid } of records) {
        expect(['gone', 'zombie']).toContain(await waitForProcessExit(pid, ownerToken))
      }
    }
    finally {
      // 失败时只清理证据中登记且身份仍匹配的测试进程，不按名称或全局进程组回收。
      await cleanupFixtureProcesses(evidence, ownerToken)
    }
  }, 20000)
})
