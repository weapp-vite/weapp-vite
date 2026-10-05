import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertJournalReleased, assertOwnedWindowLimit, assertSessionReleased } from './context'

const mocks = vi.hoisted(() => ({ records: vi.fn(), portClosed: vi.fn() }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async importOriginal => ({
  ...await importOriginal<object>(),
  readManagedWechatProjectRecords: mocks.records,
}))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host', async importOriginal => ({
  ...await importOriginal<object>(),
  isManagedPortClosed: mocks.portClosed,
}))

let directory: string
let record: ManagedWechatProjectRecord

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lifecycle-release-evidence-')))
  const profileDir = path.join(directory, 'profile')
  await fs.mkdir(profileDir)
  const start = Date.now() - 10_000
  const at = (seconds: number) => new Date(start + seconds * 1000).toISOString()
  const call = { fileIdentity: 'selected-log-generation', winId: 'owned-window', browserWindowId: 1, calledAt: at(2) }
  record = {
    schemaVersion: 1,
    id: 'owned-record',
    generation: 'current-run',
    journalPath: path.join(directory, 'journal'),
    ownerToken: 'worker-token',
    ownerPid: 1,
    target: { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), installationId: 'selected', profileDir, version: 'selected-version' },
    projectPath: path.join(directory, 'project'),
    state: 'released',
    openedProjectWindow: true,
    port: 19001,
    createdAt: at(0),
    updatedAt: at(6),
    releasedReason: 'project-closed',
    windowClose: {
      protocol: 'wechat-devtools-window-close-trace-v1',
      profileDir,
      productVersion: 'selected-version',
      capturedAt: at(1),
      dispatchedAt: at(1),
      cursors: [{ name: 'selected.log', identity: call.fileIdentity, offset: 1, anchor: 'a'.repeat(64), skipPartialLine: false }],
      calls: [call],
      window: { ...call, runtimeId: 'owned-runtime', requestedAt: at(3), nativeClosedAt: at(4), webContentsDestroyedAt: at(5) },
    },
  }
  mocks.records.mockImplementation(async () => [record])
  mocks.portClosed.mockResolvedValue(true)
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

function session() {
  return { id: record.id, journalPath: record.journalPath, port: record.port! }
}

describe('lifecycle native-window release acceptance', () => {
  it('reports selected-version native identities and both destruction events for every owned release', async () => {
    const expected = { state: 'released', portClosed: true, windowClose: { productVersion: record.target.version, winId: 'owned-window', browserWindowId: 1, runtimeId: 'owned-runtime', nativeClosedAt: record.windowClose!.window!.nativeClosedAt, webContentsDestroyedAt: record.windowClose!.window!.webContentsDestroyedAt } }
    expect(await assertSessionReleased(session())).toMatchObject(expected)
    expect(await assertJournalReleased(record.journalPath)).toEqual([expect.objectContaining({ windowClose: expect.objectContaining(expected.windowClose) })])
    expect(await assertOwnedWindowLimit(record.journalPath)).toHaveLength(1)
  })

  it.each([
    ['no cursor', (value: ManagedWechatProjectRecord) => { delete value.windowClose }],
    ['no native close', (value: ManagedWechatProjectRecord) => { delete value.windowClose!.window!.nativeClosedAt }],
    ['no webcontents destruction', (value: ManagedWechatProjectRecord) => { delete value.windowClose!.window!.webContentsDestroyedAt }],
    ['wrong selected version', (value: ManagedWechatProjectRecord) => { value.windowClose!.productVersion = 'other-version' }],
    ['wrong profile', (value: ManagedWechatProjectRecord) => { value.windowClose!.profileDir = path.join(directory, 'other-profile') }],
    ['cancelled window', (value: ManagedWechatProjectRecord) => { value.windowClose!.window!.cancelled = true }],
    ['wrong log generation', (value: ManagedWechatProjectRecord) => { value.windowClose!.window!.fileIdentity = 'another-log' }],
    ['wrong browser window', (value: ManagedWechatProjectRecord) => { value.windowClose!.window!.browserWindowId = 2 }],
    ['ambiguous close call', (value: ManagedWechatProjectRecord) => { value.windowClose!.calls.push({ ...value.windowClose!.calls[0]! }) }],
    ['previous ownership generation', (value: ManagedWechatProjectRecord) => { value.createdAt = value.windowClose!.window!.nativeClosedAt! }],
    ['old destruction event', (value: ManagedWechatProjectRecord) => { value.windowClose!.window!.nativeClosedAt = value.createdAt }],
    ['invalid timestamp', (value: ManagedWechatProjectRecord) => { value.windowClose!.window!.webContentsDestroyedAt = 'invalid-time' }],
    ['evidence failure', (value: ManagedWechatProjectRecord) => { value.windowClose!.failure = 'ambiguous' }],
  ] as const)('rejects released state and a closed port with %s', async (_name, change) => {
    change(record)
    await expect(assertSessionReleased(session())).rejects.toThrow()
    await expect(assertJournalReleased(record.journalPath)).rejects.toThrow()
    await expect(assertOwnedWindowLimit(record.journalPath)).rejects.toThrow()
    expect(mocks.portClosed).not.toHaveBeenCalled()
  })

  it('retains the additional port-release requirement after native destruction is proven', async () => {
    mocks.portClosed.mockResolvedValue(false)
    await expect(assertSessionReleased(session())).rejects.toThrow('automator port must be closed')
    await expect(assertJournalReleased(record.journalPath)).rejects.toThrow('open owned port')
  })

  it('preserves a borrowed receipt without requiring its manual window or port to close', async () => {
    record.openedProjectWindow = false
    record.releasedReason = 'borrowed'
    delete record.windowClose
    expect(await assertJournalReleased(record.journalPath)).toEqual([expect.objectContaining({ releasedReason: 'borrowed' })])
    expect(mocks.portClosed).not.toHaveBeenCalled()
    await expect(assertSessionReleased(session())).rejects.toThrow('official opened-window receipt')
  })
})
