import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkKilledWorker } from './worker'

const mocks = vi.hoisted(() => ({ execa: vi.fn(), journal: vi.fn(), records: vi.fn(), cleanup: vi.fn(), released: vi.fn(), allReleased: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('../../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async importOriginal => ({
  ...await importOriginal<object>(),
  readManagedWechatProjectRecords: mocks.records,
  cleanupManagedWechatProjects: mocks.cleanup,
}))
vi.mock('./context', async importOriginal => ({
  ...await importOriginal<object>(),
  assertSessionReleased: mocks.released,
  assertJournalReleased: mocks.allReleased,
}))

let directory: string
let journalPath: string
let options: Parameters<typeof checkKilledWorker>[0]

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lifecycle-worker-'))
  journalPath = path.join(directory, 'child-journal')
  options = { projectPath: path.join(directory, 'project'), cliPath: path.join(directory, 'cli'), sdkVersion: 'fixture-sdk', selectedVersion: 'selected-version', scriptPath: path.join(directory, 'worker.ts'), journalPath: path.join(directory, 'parent-journal'), runDirectory: directory, signal: new AbortController().signal }
  mocks.journal.mockResolvedValue(journalPath)
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.released.mockResolvedValue({ portClosed: true, windowClose: { nativeClosedAt: 'closed', webContentsDestroyedAt: 'destroyed' } })
  mocks.allReleased.mockResolvedValue([])
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

function worker(actualSignal: string | undefined) {
  const result = Promise.withResolvers<{ signal?: string, exitCode?: number, stdout: string, stderr: string }>()
  const stdout = new EventEmitter()
  const child = Object.assign(result.promise, {
    pid: 123,
    stdout,
    kill: vi.fn(() => {
      result.resolve({ signal: actualSignal, exitCode: actualSignal ? undefined : 0, stdout: 'worker output', stderr: '' })
      return true
    }),
  })
  const evidence = { pid: child.pid, id: 'worker-record', journalPath, projectPath: options.projectPath, port: 19001, info: { version: options.selectedVersion, SDKVersion: options.sdkVersion } }
  mocks.records.mockResolvedValue([{ id: evidence.id, ownerPid: child.pid, state: 'owned' }])
  mocks.execa.mockImplementation(() => {
    queueMicrotask(() => stdout.emit('data', `DEVTOOLS_LIFECYCLE_WORKER_READY:${JSON.stringify(evidence)}\n`))
    return child
  })
  return child
}

describe('lifecycle worker exit acceptance', () => {
  it('does not create a journal or worker after cancellation', async () => {
    const reason = new Error('already cancelled')
    options.signal = AbortSignal.abort(reason)
    await expect(checkKilledWorker(options)).rejects.toBe(reason)
    expect(mocks.journal).not.toHaveBeenCalled()
    expect(mocks.execa).not.toHaveBeenCalled()
  })

  it('checks cancellation again after asynchronous journal creation', async () => {
    const controller = new AbortController()
    options.signal = controller.signal
    const reason = new Error('cancelled while registering')
    mocks.journal.mockImplementation(async () => {
      controller.abort(reason)
      return journalPath
    })
    await expect(checkKilledWorker(options)).rejects.toBe(reason)
    expect(mocks.execa).not.toHaveBeenCalled()
  })

  it('accepts only an actual SIGKILL exit and preserves its native destruction report', async () => {
    const child = worker('SIGKILL')
    const report = await checkKilledWorker(options)
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(report).toMatchObject({ killed: { signal: 'SIGKILL' }, cleanup: { windowClose: { nativeClosedAt: 'closed', webContentsDestroyedAt: 'destroyed' } } })
    expect(mocks.execa.mock.calls[0]![2]).toMatchObject({ killDescendants: false })
  })

  it('rejects a normal exit even when the signal send returned true, and still cleans the journal', async () => {
    worker(undefined)
    await expect(checkKilledWorker(options)).rejects.toThrow('Worker recovery or evidence persistence did not complete')
    expect(mocks.released).not.toHaveBeenCalled()
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith({ journalPath, scope: 'journal' })
  })
})
