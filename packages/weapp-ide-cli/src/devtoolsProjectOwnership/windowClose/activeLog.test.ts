import type { ManagedWechatHostIdentity, ManagedWechatProjectRecord } from '../types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureActiveMainLogCursors } from './activeLog'
import { createActiveLogFixture, descriptor } from './activeLogFixture'

const mocks = vi.hoisted(() => ({ command: vi.fn(), identity: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.command }))
vi.mock('../host', async importOriginal => ({
  ...await importOriginal<typeof import('../host')>(),
  readManagedProcessIdentity: mocks.identity,
}))

let directory: string
let logDirectory: string
let logFile: string
let main: ManagedWechatHostIdentity
let backend: ManagedWechatHostIdentity
let record: ManagedWechatProjectRecord
let output: string
let afterInspection: (() => Promise<void>) | undefined

beforeEach(async () => {
  vi.resetAllMocks()
  ;({ directory, logDirectory, logFile, main, backend, record } = await createActiveLogFixture())
  output = `p${main.pid}\0\n${await descriptor(logFile)}`
  afterInspection = undefined
  mocks.identity.mockImplementation(async (pid: number) => ({ ...(pid === backend.pid ? backend : main) }))
  mocks.command.mockImplementation(async (command: string) => {
    if (command === 'ps') {
      return { exitCode: 0, stdout: ` ${main.pid}\n` }
    }
    await afterInspection?.()
    return { exitCode: 0, stdout: output }
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

describe('active main process log binding', () => {
  it('binds a recreated stream without a MAIN header and ignores historical MAIN contents', async () => {
    await fs.writeFile(path.join(logDirectory, 'historical.log'), '[timestamp][INFO][2.02.2608070][MAIN] old boot\n')
    const stat = await fs.stat(logFile, { bigint: true })
    const before = structuredClone(record)

    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toEqual({ cursors: [expect.objectContaining({ name: 'current.log', identity: `${stat.dev}:${stat.ino}` })], host: main })
    expect(record).toEqual(before)
    expect(mocks.command).toHaveBeenCalledWith('lsof', ['-nP', '-a', '-p', String(main.pid), '-F0pftainDk'], expect.objectContaining({ reject: false, timeout: 3_000 }))
    expect(mocks.command.mock.calls.filter(([command]) => command === 'ps')).toHaveLength(2)
    expect(mocks.identity).toHaveBeenCalledTimes(4)
  })

  it('excludes old unlinked descriptors while retaining the existing active stream', async () => {
    output += await descriptor(logFile, { f: '65', k: '0', n: path.join(logDirectory, 'removed.log') })
    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toMatchObject({ cursors: [{ name: 'current.log' }], host: main })
  })

  it('supports the listener being the main process itself without following its parent', async () => {
    record.host = { ...main }
    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toMatchObject({ host: main })
    expect(mocks.command).toHaveBeenCalledTimes(2)
    expect(mocks.identity).toHaveBeenCalledTimes(2)
  })

  it.each(['linux', 'win32'] as const)('retains the legacy selector on %s without process inspection', async (platform) => {
    expect(await captureActiveMainLogCursors(record, logDirectory, platform)).toBeUndefined()
    expect(mocks.command).not.toHaveBeenCalled()
    expect(mocks.identity).not.toHaveBeenCalled()
  })

  it('retains the legacy selector without a recorded host', async () => {
    delete record.host
    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toBeUndefined()
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it.each(['missing', 'pid', 'started', 'executable'] as const)('rejects a %s recorded backend identity', async (kind) => {
    mocks.identity.mockResolvedValueOnce(kind === 'missing' ? undefined : { ...backend, [kind]: kind === 'pid' ? backend.pid + 1 : 'changed' })
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('process identity changed')
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it.each(['backend', 'parent'] as const)('rejects a %s from another installation with the same app prefix', async (kind) => {
    const other = path.join(directory, 'selected.app.other', 'Contents', 'MacOS', 'Electron')
    await fs.mkdir(path.dirname(other), { recursive: true })
    await fs.writeFile(other, '')
    if (kind === 'backend') {
      backend.executable = other
      record.host = { ...backend }
    }
    else {
      main.executable = other
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow(kind === 'backend' ? 'different installation' : 'selected main executable')
    expect(mocks.command.mock.calls.some(([command]) => command === 'lsof')).toBe(false)
  })

  it('rejects a parent generation newer than its recorded backend', async () => {
    main.started = 'Mon Oct 5 12:30:03 2026'
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('generation is inconsistent')
  })

  it.each(['', '0', '-1', '2\n3', 'not-a-pid'])('rejects an invalid direct parent %j', async (stdout) => {
    mocks.command.mockResolvedValueOnce({ exitCode: 0, stdout })
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('parent process could not be verified')
  })

  it.each(['backend', 'parent', 'reparent'] as const)('rejects %s replacement during file inspection', async (kind) => {
    afterInspection = async () => {
      if (kind === 'backend') {
        backend.started = 'Mon Oct 5 12:30:04 2026'
      }
      else if (kind === 'parent') {
        main.started = 'Mon Oct 5 12:30:00 2026'
      }
      else {
        main.pid += 1
      }
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow(/process.*changed|ambiguous process/)
  })

  it('rejects lsof errors without guessing from old log contents', async () => {
    mocks.command.mockImplementation(async command => command === 'ps' ? { exitCode: 0, stdout: String(main.pid) } : { exitCode: 1, stdout: output })
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('inspection failed')
  })

  it.each(['other-process', 'second-process', 'duplicate-field', 'missing-process'] as const)('rejects %s descriptor output', async (kind) => {
    if (kind === 'other-process') {
      output = output.replace(`p${main.pid}`, `p${main.pid + 1}`)
    }
    else if (kind === 'second-process') {
      output += `p${main.pid}\0\n`
    }
    else if (kind === 'duplicate-field') {
      output += 'aw\0\n'
    }
    else {
      output = ''
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('MAIN log')
  })

  it.each([{ a: 'r' }, { t: 'DIR' }, { f: 'txt' }, { n: path.join(os.tmpdir(), 'different-profile.log') }])('requires a writable regular descriptor under the selected profile: %j', async (overrides) => {
    output = `p${main.pid}\0\n${await descriptor(logFile, overrides)}`
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('at least one verified writable file')
  })

  it.each([{ i: '0' }, { D: '0x0' }, { k: '2' }, { D: '' }])('rejects mismatched or missing file identity: %j', async (overrides) => {
    output = `p${main.pid}\0\n${await descriptor(logFile, overrides)}`
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('MAIN log')
  })

  it.each(['removed', 'replaced'] as const)('rejects a linked descriptor whose path is %s during inspection', async (kind) => {
    afterInspection = async () => {
      await fs.rename(logFile, `${logFile}.old`)
      if (kind === 'replaced') {
        await fs.writeFile(logFile, '')
      }
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow()
  })

  it('checks the file identity again after process verification', async () => {
    let backendReads = 0
    mocks.identity.mockImplementation(async (pid: number) => {
      if (pid === backend.pid && ++backendReads === 2) {
        await fs.rename(logFile, `${logFile}.old`)
        await fs.writeFile(logFile, '')
      }
      return { ...(pid === backend.pid ? backend : main) }
    })
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('redirected or replaced')
  })

  it('rejects rotation between descriptor samples even when the old file still exists', async () => {
    const second = path.join(logDirectory, 'rotated.log')
    await fs.writeFile(second, '')
    const rotated = `p${main.pid}\0\n${await descriptor(second)}`
    let samples = 0
    afterInspection = async () => {
      if (++samples === 2) {
        output = rotated
      }
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('file descriptor set changed during capture')
    expect(await fs.stat(logFile)).toBeDefined()
  })

  it('rejects a descriptor that is no longer held at the second sample', async () => {
    let samples = 0
    afterInspection = async () => {
      if (++samples === 2) {
        output = `p${main.pid}\0\n`
      }
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('at least one verified writable file')
  })

  it('rejects a log path redirected after the descriptor snapshot', async () => {
    afterInspection = async () => {
      await fs.rename(logFile, `${logFile}.old`)
      await fs.symlink(logDirectory, logFile, 'junction')
    }
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('redirected or replaced')
  })

  it('rejects a redirected log directory', async () => {
    const alias = path.join(directory, 'alias')
    await fs.symlink(logDirectory, alias, 'junction')
    await expect(captureActiveMainLogCursors(record, alias, 'darwin')).rejects.toThrow('directory was redirected')
  })

  it('resolves selected installation aliases before matching executables', async () => {
    const alias = path.join(directory, 'alias.app')
    await fs.symlink(path.join(directory, 'selected.app'), alias, 'junction')
    record.target.appPath = path.join(alias, 'Contents', 'Resources', 'app.asar')
    record.target.cliPath = path.join(alias, 'Contents', 'MacOS', 'cli')
    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toMatchObject({ host: main })
  })

  it.each(['app', 'package.nw'])('supports the selected unpacked %s resource layout', async (name) => {
    record.target.appPath = path.join(path.dirname(record.target.appPath), name)
    await fs.mkdir(record.target.appPath)
    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toMatchObject({ host: main })
  })

  it('rejects application resources from a different bundle', async () => {
    record.target.appPath = path.join(directory, 'other.app', 'Contents', 'Resources', 'app.asar')
    await fs.mkdir(path.dirname(record.target.appPath), { recursive: true })
    await fs.writeFile(record.target.appPath, '')
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('CLI and application resources')
  })

  it('rejects another profile even if its logs are writable by the same main process', async () => {
    record.target.profileDir = path.join(directory, 'other-profile')
    await fs.mkdir(record.target.profileDir)
    await expect(captureActiveMainLogCursors(record, logDirectory, 'darwin')).rejects.toThrow('selected profile')
  })

  it('preserves whitespace and supported newline characters in NUL-delimited paths', async () => {
    const filename = path.join(logDirectory, process.platform === 'win32' ? 'current log name.log' : 'current log\nname.log')
    await fs.rename(logFile, filename)
    output = `p${main.pid}\0\n${await descriptor(filename)}`
    expect(await captureActiveMainLogCursors(record, logDirectory, 'darwin')).toMatchObject({ cursors: [{ name: path.basename(filename) }] })
  })
})
