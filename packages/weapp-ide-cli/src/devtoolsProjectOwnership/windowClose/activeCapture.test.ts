import type { ManagedWechatHostIdentity } from '../types'
import type { WindowCloseFixture } from './fixture'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowCloseFixture } from './fixture'
import { captureLogCursors } from './logCursor'
import { managedWindowCloseSchema } from './schema'

const mocks = vi.hoisted(() => ({ active: vi.fn(), identity: vi.fn() }))
vi.mock('./activeLog', () => ({ readActiveMainLog: mocks.active }))
vi.mock('../host', async importOriginal => ({
  ...await importOriginal<typeof import('../host')>(),
  readManagedProcessIdentity: mocks.identity,
}))

let fixture: WindowCloseFixture
let mainHost: ManagedWechatHostIdentity

beforeEach(async () => {
  vi.resetAllMocks()
  fixture = await createWindowCloseFixture()
  mainHost = { pid: 42, executable: path.join(fixture.directory, 'app', 'Contents', 'MacOS', 'Electron'), started: 'original-generation' }
  await fs.writeFile(fixture.logFile, fixture.line('forwarded simulator state', 'BACKEND'))
  const stat = await fs.stat(fixture.logFile)
  mocks.active.mockResolvedValue({ name: path.basename(fixture.logFile), identity: `${stat.dev}:${stat.ino}`, host: mainHost })
  mocks.identity.mockResolvedValue(mainHost)
})

afterEach(async () => fixture.dispose())

function completeTrace() {
  return fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed()
}

describe('native log owner capture after retention rotation', () => {
  it('binds the active file before its first MAIN event and preserves all destruction requirements', async () => {
    await expect(captureLogCursors(fixture.logDirectory, fixture.record.target.version!)).rejects.toThrow('one unambiguous MAIN log')
    await fixture.capture()
    expect(managedWindowCloseSchema.parse(fixture.record.windowClose).mainHost).toEqual(mainHost)
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request() + fixture.closed())
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    await fs.appendFile(fixture.logFile, fixture.destroyed())
    await fixture.wait()
    expect(fixture.record.windowClose?.window).toMatchObject({ nativeClosedAt: expect.any(String), webContentsDestroyedAt: expect.any(String) })
    expect(mocks.active).toHaveBeenCalledTimes(1)
  })

  it('rejects a file replacement between handle inspection and cursor capture', async () => {
    await fs.rename(fixture.logFile, `${fixture.logFile}.old`)
    await fs.writeFile(fixture.logFile, fixture.line('new owner', 'BACKEND'))
    await expect(fixture.capture()).rejects.toThrow('active log changed')
    expect(fixture.record.windowClose).toBeUndefined()
  })

  it('resumes a persisted cursor after the backend exits without locating another project host', async () => {
    fixture.record.host = { pid: 43, executable: path.join(fixture.directory, 'backend'), started: 'backend-generation' }
    await fixture.capture()
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request())
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    fixture.record.windowClose = managedWindowCloseSchema.parse(JSON.parse(JSON.stringify(fixture.record.windowClose)))
    mocks.identity.mockImplementation(async pid => pid === mainHost.pid ? mainHost : undefined)
    await fs.appendFile(fixture.logFile, fixture.closed() + fixture.destroyed())
    await fixture.wait()
    expect(mocks.active).toHaveBeenCalledTimes(1)
    expect(mocks.identity.mock.calls.every(([pid]) => pid === mainHost.pid)).toBe(true)
    expect(fixture.record.windowClose.window?.webContentsDestroyedAt).toEqual(expect.any(String))
  })

  it.each(['missing', 'reused'] as const)('rejects a %s owner even when a complete trace is appended', async (kind) => {
    await fixture.capture()
    await fs.appendFile(fixture.logFile, completeTrace())
    mocks.identity.mockResolvedValue(kind === 'missing' ? undefined : { ...mainHost, started: 'another-generation' })
    await expect(fixture.wait()).rejects.toThrow('main log owner changed')
    expect(fixture.record.windowClose?.window).toBeUndefined()
  })

  it('never retargets a bound cursor after another retention rotation', async () => {
    await fixture.capture()
    await fs.rename(fixture.logFile, `${fixture.logFile}.old`)
    await fs.writeFile(fixture.logFile, completeTrace())
    await expect(fixture.wait()).rejects.toThrow('replaced, truncated, or rewritten')
    expect(mocks.active).toHaveBeenCalledTimes(1)
  })

  it('still rejects a destruction trace from another product version', async () => {
    await fixture.capture()
    await fs.appendFile(fixture.logFile, completeTrace().replaceAll(fixture.record.target.version!, 'different-version'))
    await expect(fixture.wait()).rejects.toThrow('different product version')
  })

  it('cannot grant an unverified active file a close cursor', async () => {
    mocks.active.mockResolvedValue(undefined)
    await expect(fixture.capture()).rejects.toThrow('one unambiguous MAIN log')
    expect(fixture.record.windowClose).toBeUndefined()
  })

  it('uses the active file even when a historical MAIN log survives rotation', async () => {
    await fs.writeFile(path.join(fixture.logDirectory, 'historical-main.log'), fixture.boot())
    await fixture.capture()
    expect(fixture.record.windowClose?.cursors[0]?.name).toBe(path.basename(fixture.logFile))
    await fs.appendFile(fixture.logFile, completeTrace())
    await fixture.wait()
    expect(fixture.record.windowClose?.window?.webContentsDestroyedAt).toEqual(expect.any(String))
  })

  it('keeps the original strict MAIN gate where active handle binding is unavailable', async () => {
    mocks.active.mockResolvedValue(undefined)
    await fs.appendFile(fixture.logFile, fixture.boot())
    await fixture.capture()
    expect(fixture.record.windowClose?.mainHost).toBeUndefined()
    await fs.writeFile(path.join(fixture.logDirectory, 'ambiguous.log'), fixture.boot())
    await expect(fixture.capture()).rejects.toThrow('one unambiguous MAIN log')
  })

  it('never falls back to a historical MAIN log after active owner validation fails', async () => {
    await fs.appendFile(fixture.logFile, fixture.boot())
    mocks.active.mockRejectedValue(new Error('main process identity changed'))
    await expect(fixture.capture()).rejects.toThrow('main process identity changed')
    expect(fixture.record.windowClose).toBeUndefined()
  })
})
