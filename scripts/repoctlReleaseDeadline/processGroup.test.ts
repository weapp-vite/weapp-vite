import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { readLinuxProcessState, waitForProcessExit } from './processState'

const temporaryDirectories: string[] = []
const helper = fileURLToPath(new URL('../../.github/scripts/release-stage.sh', import.meta.url))
const timeoutResolver = fileURLToPath(new URL('../../.github/scripts/release-timeout.sh', import.meta.url))
const resolved = process.platform === 'win32' ? undefined : spawnSync('bash', [timeoutResolver], { encoding: 'utf8' })
const gnuTimeout = resolved?.status === 0 ? resolved.stdout.trim() : undefined

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

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
    return readLinuxProcessState(pid, ownerToken)
  }
  const result = spawnSync('ps', ['eww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
  if (result.status !== 0) {
    return 'gone'
  }
  return result.stdout.includes(`FIXTURE_OWNER_TOKEN=${ownerToken}`) ? 'running' : 'foreign'
}

async function cleanupFixtureProcesses(evidence: string, ownerToken: string) {
  for (const { pid } of await readProcessRecords(evidence)) {
    if (await waitForProcessExit(() => processState(pid, ownerToken)) !== 'running') {
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
    await waitForProcessExit(() => processState(pid, ownerToken))
  }
}

describe.skipIf(process.platform === 'win32')('release deadline process ownership', () => {
  it.each(['Z', 'X'])('recognizes terminal state %s without treating an unreadable live process as exited', async (state) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release-proc-state-'))
    temporaryDirectories.push(directory)
    const processDirectory = path.join(directory, '17')
    await fs.mkdir(processDirectory)
    const environment = path.join(processDirectory, 'environ')
    const stat = path.join(processDirectory, 'stat')
    await fs.writeFile(environment, 'FIXTURE_OWNER_TOKEN=owned\0', { mode: 0o000 })
    const readProcessFile = (file: string) => fs.readFile(path.join(directory, path.relative('/proc', file)), 'utf8')
    await expect(fs.readFile(environment)).rejects.toMatchObject({ code: 'EACCES' })
    await fs.writeFile(stat, `17 (fixture) ${state} 1 17`)
    await expect(readLinuxProcessState(17, 'owned', readProcessFile)).resolves.toBe('zombie')
    await fs.writeFile(stat, '17 (fixture) S 1 17')
    await expect(readLinuxProcessState(17, 'owned', readProcessFile)).rejects.toMatchObject({ code: 'EACCES' })
    await fs.chmod(environment, 0o600)
    await expect(readLinuxProcessState(17, 'owned', readProcessFile)).resolves.toBe('running')
    await expect(readLinuxProcessState(17, 'another-owner', readProcessFile)).resolves.toBe('foreign')
    await fs.rm(processDirectory, { recursive: true })
    await expect(readLinuxProcessState(17, 'owned', readProcessFile)).resolves.toBe('gone')
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
        expect(['gone', 'zombie']).toContain(await waitForProcessExit(() => processState(pid, ownerToken)))
      }
    }
    finally {
      // 失败时只清理证据中登记且身份仍匹配的测试进程，不按名称或全局进程组回收。
      await cleanupFixtureProcesses(evidence, ownerToken)
    }
  }, 20000)
})
