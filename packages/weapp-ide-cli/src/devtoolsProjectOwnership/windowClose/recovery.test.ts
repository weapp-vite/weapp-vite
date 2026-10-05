import type { WindowCloseFixture } from './fixture'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeManagedWechatProject } from '../index'
import { readManagedRecord, writeManagedRecord } from '../journal'
import { createWindowCloseFixture, legacyInventoryFailure, snapshotLegacyCursor } from './fixture'
import { managedWindowCloseSchema } from './schema'

const mocks = vi.hoisted(() => ({ cli: vi.fn(), identity: vi.fn(), waitClosed: vi.fn(), inspect: vi.fn(), installation: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.cli }))
vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<object>(),
  withMachineE2ELease: async (run: () => Promise<unknown>) => run(),
}))
vi.mock('../host', async importOriginal => ({
  ...await importOriginal<typeof import('../host')>(),
  readManagedProcessIdentity: mocks.identity,
  waitForManagedPortClosed: mocks.waitClosed,
  inspectManagedProjectHost: mocks.inspect,
  assertManagedInstallation: mocks.installation,
}))

let fixture: WindowCloseFixture
let emptyLog: string
let helperLog: string

beforeEach(async () => {
  vi.resetAllMocks()
  mocks.identity.mockImplementation(async (pid: number) => ({ pid, executable: 'test-worker', started: 'same-worker' }))
  mocks.waitClosed.mockResolvedValue(undefined)
  mocks.cli.mockRejectedValue(new Error('Recovery must not send another CLI close command'))
  fixture = await createWindowCloseFixture()
  await fixture.capture()
  await fs.appendFile(fixture.logFile, fixture.call('s5', 7))
  await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
  emptyLog = path.join(fixture.logDirectory, 'old-empty.log')
  helperLog = path.join(fixture.logDirectory, 'old-helper.log')
  await fs.writeFile(emptyLog, '')
  await fs.writeFile(helperLog, fixture.line('old watcher', 'DevtoolsFileWatcher'))
  fixture.record.windowClose!.cursors = await Promise.all(
    [fixture.logFile, emptyLog, helperLog].sort().map(file => snapshotLegacyCursor(file)),
  )
  fixture.record.windowClose!.failure = legacyInventoryFailure
  fixture.record.state = 'failed'
  fixture.record.host = { pid: process.pid, executable: 'selected-backend', started: 'backend-generation' }
  fixture.record.port = 19001
})

afterEach(async () => {
  await fixture.dispose()
})

async function finishOriginalWindow() {
  await fs.appendFile(fixture.logFile, fixture.request(fixture.record.projectPath, 's5') + fixture.closed('s5') + fixture.destroyed('s5', 7))
}

async function recoverFromJournal() {
  await fs.mkdir(fixture.record.journalPath, { recursive: true })
  await writeManagedRecord(fixture.record)
  await closeManagedWechatProject({ journalPath: fixture.record.journalPath, id: fixture.record.id })
  return readManagedRecord(fixture.record.journalPath, fixture.record.id)
}

describe('legacy managed close log inventory recovery', () => {
  it.each([false, true])('resumes the persisted original call with close acknowledgement=%s without redispatch', async (acknowledged) => {
    const originalCursors = structuredClone(fixture.record.windowClose!.cursors)
    const originalCalls = structuredClone(fixture.record.windowClose!.calls)
    const dispatchedAt = fixture.record.windowClose!.dispatchedAt
    if (acknowledged) {
      fixture.record.closeAcknowledgedAt = dispatchedAt
    }
    await fs.rm(emptyLog)
    await fs.writeFile(path.join(fixture.logDirectory, 'new-helper.log'), fixture.line('current watcher', 'DevtoolsFileWatcher'))
    await finishOriginalWindow()

    const saved = await recoverFromJournal()

    expect(saved).toMatchObject({ state: 'released', releasedReason: 'project-closed' })
    expect(saved.windowClose).toMatchObject({
      dispatchedAt,
      calls: originalCalls,
      window: { winId: 's5', browserWindowId: 7, nativeClosedAt: expect.any(String), webContentsDestroyedAt: expect.any(String) },
      logInventoryRecovery: { failure: legacyInventoryFailure, cursors: originalCursors },
    })
    expect(saved.windowClose?.failure).toBeUndefined()
    expect(saved.windowClose?.cursors).toEqual([
      expect.objectContaining({ name: path.basename(fixture.logFile), identity: originalCalls[0]!.fileIdentity }),
    ])
    expect(managedWindowCloseSchema.parse(saved.windowClose)).toMatchObject({
      logInventoryRecovery: { failure: legacyInventoryFailure, cursors: originalCursors },
    })
    await closeManagedWechatProject({ journalPath: saved.journalPath, id: saved.id })
    expect(mocks.cli).not.toHaveBeenCalled()
    expect(mocks.inspect).not.toHaveBeenCalled()
    expect(mocks.installation).not.toHaveBeenCalled()
    expect(mocks.waitClosed).toHaveBeenCalledOnce()
  })

  it.each(['Managed DevTools exact project close was cancelled.', `${legacyInventoryFailure} another failure followed`])('retains the permanent failure %s even when the original destruction chain becomes complete', async (failure) => {
    fixture.record.windowClose!.failure = failure
    await finishOriginalWindow()

    await expect(recoverFromJournal()).rejects.toThrow(failure)
    const saved = await readManagedRecord(fixture.record.journalPath, fixture.record.id)
    expect(saved).toMatchObject({ state: 'failed', windowClose: { failure } })
    expect(saved.windowClose).not.toHaveProperty('logInventoryRecovery')
    expect(mocks.cli).not.toHaveBeenCalled()
    expect(mocks.waitClosed).not.toHaveBeenCalled()
  })

  it.each(['nonempty-missing', 'empty-anchor-changed', 'empty-partial-line', 'main-missing', 'main-replaced', 'main-truncated', 'main-rewritten'] as const)('refuses legacy recovery with %s evidence', async (kind) => {
    if (kind === 'nonempty-missing') {
      await fs.rm(helperLog)
    }
    else if (kind === 'empty-anchor-changed' || kind === 'empty-partial-line') {
      const cursor = fixture.record.windowClose!.cursors.find(item => item.name === path.basename(emptyLog))!
      if (kind === 'empty-anchor-changed') {
        cursor.anchor = 'a'.repeat(64)
      }
      else {
        cursor.skipPartialLine = true
      }
      await fs.rm(emptyLog)
    }
    else if (kind === 'main-missing') {
      await fs.rm(fixture.logFile)
    }
    else if (kind === 'main-replaced') {
      await fs.rename(fixture.logFile, `${fixture.logFile}.old`)
      await fs.writeFile(fixture.logFile, fixture.boot())
    }
    else if (kind === 'main-truncated') {
      await fs.truncate(fixture.logFile, 0)
    }
    else {
      const contents = await fs.readFile(fixture.logFile, 'utf8')
      await fs.writeFile(fixture.logFile, contents.replace('s5', 's6'))
    }
    await fs.writeFile(path.join(fixture.logDirectory, 'new-main.log'), fixture.boot() + fixture.call('s5', 7) + fixture.request(fixture.record.projectPath, 's5') + fixture.closed('s5') + fixture.destroyed('s5', 7))

    await expect(fixture.wait()).rejects.toThrow()
    expect(fixture.record.windowClose?.failure).toBe(legacyInventoryFailure)
    expect(fixture.record.windowClose).not.toHaveProperty('logInventoryRecovery')
  })

  it.each(['call', 'window'] as const)('does not migrate a saved %s from a different stream identity', async (kind) => {
    const evidence = fixture.record.windowClose!
    const call = evidence.calls[0]!
    if (kind === 'call') {
      call.fileIdentity = 'different-stream'
    }
    else {
      evidence.window = { ...call, fileIdentity: 'different-stream', runtimeId: '0', requestedAt: call.calledAt }
    }
    await finishOriginalWindow()

    await expect(fixture.wait()).rejects.toThrow()
    expect(evidence.failure).toBe(legacyInventoryFailure)
    expect(evidence).not.toHaveProperty('logInventoryRecovery')
  })

  it('cannot select a MAIN header that only appeared after the persisted offset', async () => {
    const auxiliary = fixture.line('helper initialized', 'DevtoolsFileWatcher')
    await fs.writeFile(fixture.logFile, auxiliary)
    fixture.record.windowClose!.cursors = [await snapshotLegacyCursor(fixture.logFile)]
    await fs.appendFile(fixture.logFile, fixture.boot())
    await finishOriginalWindow()

    await expect(fixture.wait()).rejects.toThrow()
    expect(fixture.record.windowClose?.failure).toBe(legacyInventoryFailure)
    expect(fixture.record.windowClose).not.toHaveProperty('logInventoryRecovery')
  })

  it('cannot complete a partial MAIN record using bytes after the persisted offset', async () => {
    const header = fixture.line('project window ready')
    await fs.writeFile(fixture.logFile, fixture.line('simulator initialized', 'BACKEND') + header.trimEnd())
    fixture.record.windowClose!.cursors = [await snapshotLegacyCursor(fixture.logFile)]
    await fs.appendFile(fixture.logFile, '\n')
    await finishOriginalWindow()

    await expect(fixture.wait()).rejects.toThrow('one unambiguous MAIN log')
    expect(fixture.record.windowClose?.failure).toBe(legacyInventoryFailure)
    expect(fixture.record.windowClose).not.toHaveProperty('logInventoryRecovery')
  })

  it('recovers a mixed stream whose MAIN record preceded the persisted offset', async () => {
    await fs.writeFile(fixture.logFile, fixture.line('simulator initialized', 'BACKEND') + fixture.line('project window ready') + fixture.call('s5', 7))
    fixture.record.windowClose!.cursors = [await snapshotLegacyCursor(fixture.logFile)]
    await finishOriginalWindow()

    await fixture.wait()

    expect(fixture.record.windowClose?.failure).toBeUndefined()
    expect(fixture.record.windowClose?.window).toMatchObject({
      winId: 's5',
      nativeClosedAt: expect.any(String),
      webContentsDestroyedAt: expect.any(String),
    })
  })

  it('rejects ambiguity between two MAIN streams in the original inventory', async () => {
    await fs.writeFile(helperLog, fixture.boot())
    const cursors = fixture.record.windowClose!.cursors
    cursors[cursors.findIndex(cursor => cursor.name === path.basename(helperLog))] = await snapshotLegacyCursor(helperLog)
    await finishOriginalWindow()

    await expect(fixture.wait()).rejects.toThrow()
    expect(fixture.record.windowClose?.failure).toBe(legacyInventoryFailure)
    expect(fixture.record.windowClose).not.toHaveProperty('logInventoryRecovery')
  })

  it('keeps the lane blocked after migration when the exact window lacks one destruction event', async () => {
    await fs.rm(emptyLog)
    await fs.appendFile(fixture.logFile, fixture.request(fixture.record.projectPath, 's5') + fixture.closed('s5'))
    const originalCursors = structuredClone(fixture.record.windowClose!.cursors)

    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(fixture.record.windowClose).toMatchObject({ logInventoryRecovery: { failure: legacyInventoryFailure, cursors: originalCursors } })
    expect(fixture.record.windowClose?.window?.webContentsDestroyedAt).toBeUndefined()
    expect(fixture.record.state).toBe('failed')
  })

  it('does not release a recovered window until its automator port is also closed', async () => {
    await fs.rm(emptyLog)
    await finishOriginalWindow()
    mocks.waitClosed.mockRejectedValueOnce(new Error('automator port remains open'))

    await expect(recoverFromJournal()).rejects.toThrow('automator port remains open')
    const saved = await readManagedRecord(fixture.record.journalPath, fixture.record.id)
    expect(saved.state).toBe('failed')
    expect(saved.releasedReason).toBeUndefined()
    expect(saved.windowClose?.window).toMatchObject({ nativeClosedAt: expect.any(String), webContentsDestroyedAt: expect.any(String) })
    await closeManagedWechatProject({ journalPath: saved.journalPath, id: saved.id })
    expect((await readManagedRecord(saved.journalPath, saved.id)).state).toBe('released')
    expect(mocks.cli).not.toHaveBeenCalled()
    expect(mocks.waitClosed).toHaveBeenCalledTimes(2)
  })
})
