import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareAutomatorBridgeWrapperProject } from './automator'
import { attachBridgeWrapperSyncCleanup, cleanupFailedBridgeLaunch } from './automatorBridgeCleanup'

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return { ...original, default: { ...original.default } }
})

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

describe('bridge snapshot failure cleanup', () => {
  let project: string
  let snapshot: NonNullable<ReturnType<typeof prepareAutomatorBridgeWrapperProject>>
  let closeWatcher: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-cleanup-'))
    const distRoot = path.join(project, 'dist')
    fs.mkdirSync(distRoot)
    fs.writeFileSync(path.join(project, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist/' }))
    fs.writeFileSync(path.join(distRoot, 'app.json'), JSON.stringify({ pages: [] }))
    const watch = vi.spyOn(fs, 'watch')
    snapshot = prepareAutomatorBridgeWrapperProject(project, { appConfigPath: path.join(distRoot, 'app.json') }, 'snapshot')!
    closeWatcher = vi.spyOn(watch.mock.results[0]!.value as fs.FSWatcher, 'close')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await snapshot.cleanup?.()
    fs.rmSync(project, { recursive: true, force: true })
    vi.useRealTimers()
  })

  it('stops watchers and subscription even when owned window cleanup fails, retaining its files', async () => {
    const error = new Error('simulator launch failed')
    const closeError = new Error('window destruction unconfirmed')
    const abort = vi.fn()
    const closeProject = vi.fn(async () => {
      throw closeError
    })
    await expect(cleanupFailedBridgeLaunch({ error, snapshot, getCloseProject: () => closeProject, subscription: { abort } }))
      .rejects
      .toMatchObject({ errors: [error, closeError] })
    expect(closeWatcher).toHaveBeenCalled()
    expect(abort).toHaveBeenCalledExactlyOnceWith(error)
    expect(vi.getTimerCount()).toBe(0)
    expect(fs.existsSync(snapshot.path)).toBe(true)
    fs.writeFileSync(path.join(project, 'dist', 'later.js'), 'must not be mirrored')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fs.existsSync(path.join(snapshot.path, 'later.js'))).toBe(false)
  })

  it('waits for a late bridge before closing the owned window and removing its files', async () => {
    const bridge = Promise.withResolvers<void>()
    const closeProject = vi.fn(async () => {
      expect(fs.existsSync(snapshot.path)).toBe(true)
    })
    let lateCloseProject: typeof closeProject | undefined
    const pending = cleanupFailedBridgeLaunch({ error: new Error('cancelled'), snapshot, getCloseProject: () => lateCloseProject, bridgeLaunch: bridge.promise })
    expect(closeWatcher).toHaveBeenCalled()
    expect(closeProject).not.toHaveBeenCalled()
    expect(fs.existsSync(snapshot.path)).toBe(true)
    lateCloseProject = closeProject
    bridge.reject(new Error('late CLI exit'))
    await pending
    expect(closeProject).toHaveBeenCalledOnce()
    expect(fs.existsSync(snapshot.path)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains files when a bridge was dispatched without a window cleanup receipt', async () => {
    await cleanupFailedBridgeLaunch({ error: new Error('missing receipt'), snapshot, bridgeLaunch: Promise.resolve() })
    expect(closeWatcher).toHaveBeenCalled()
    expect(fs.existsSync(snapshot.path)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes an unused snapshot when preflight fails before dispatch', async () => {
    await cleanupFailedBridgeLaunch({ error: new Error('preflight failed'), snapshot })
    expect(fs.existsSync(snapshot.path)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retries a failed removal on the next session close instead of marking it complete', async () => {
    const remove = vi.spyOn(fs.promises, 'rm').mockRejectedValueOnce(new Error('file busy'))
    const session = attachBridgeWrapperSyncCleanup({ close: vi.fn(async () => {}) }, snapshot)
    await expect(session.close()).rejects.toThrow('file busy')
    expect(closeWatcher).toHaveBeenCalled()
    expect(fs.existsSync(snapshot.path)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await session.close()
    await session.close()
    expect(remove).toHaveBeenCalledTimes(2)
    expect(fs.existsSync(snapshot.path)).toBe(false)
  })

  it('makes concurrent session closes both wait for the same snapshot removal', async () => {
    const barrier = Promise.withResolvers<void>()
    const originalRemove = fs.promises.rm.bind(fs.promises)
    const remove = vi.spyOn(fs.promises, 'rm').mockImplementation(async (...args) => {
      await barrier.promise
      return originalRemove(...args)
    })
    const session = attachBridgeWrapperSyncCleanup({ close: vi.fn(async () => {}) }, snapshot)
    const firstFinished = vi.fn()
    const secondFinished = vi.fn()
    const first = session.close().then(firstFinished)
    const second = session.close().then(secondFinished)
    await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce())
    expect(firstFinished).not.toHaveBeenCalled()
    expect(secondFinished).not.toHaveBeenCalled()
    barrier.resolve()
    await Promise.all([first, second])
    expect(firstFinished).toHaveBeenCalledOnce()
    expect(secondFinished).toHaveBeenCalledOnce()
    expect(fs.existsSync(snapshot.path)).toBe(false)
  })

  it('preserves files on disconnect and a failed close, then removes them after confirmed close', async () => {
    const close = vi.fn().mockRejectedValueOnce(new Error('close failed')).mockResolvedValue(undefined)
    const session = attachBridgeWrapperSyncCleanup({ close, disconnect: vi.fn(async () => {}) }, snapshot)
    await session.disconnect()
    expect(fs.existsSync(snapshot.path)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await expect(session.close()).rejects.toThrow('close failed')
    expect(fs.existsSync(snapshot.path)).toBe(true)
    await session.close()
    expect(fs.existsSync(snapshot.path)).toBe(false)
  })
})
