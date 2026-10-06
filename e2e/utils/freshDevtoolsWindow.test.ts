import type { ManagedWechatProjectRecord } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertFreshDevtoolsWindow } from './freshDevtoolsWindow'

const mocks = vi.hoisted(() => ({ readRecord: vi.fn() }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal', () => ({ readManagedRecord: mocks.readRecord }))

function createFixture() {
  const metadata = {
    projectPath: path.resolve('cold-start-project'),
    port: 19415,
    managedProject: { id: 'fresh-window', journalPath: path.resolve('task-journal') },
  }
  const expected = { projectPath: metadata.projectPath, startedAt: Date.parse('2026-01-01T00:00:00.000Z') }
  const record: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id: metadata.managedProject.id,
    generation: 'current-launch',
    journalPath: metadata.managedProject.journalPath,
    ownerPid: 42,
    ownerToken: 'private-owner-token',
    target: { cliPath: path.resolve('selected-cli'), appPath: path.resolve('selected-app'), profileDir: path.resolve('selected-profile'), installationId: 'selected', version: '1.0.0', channel: 'stable' },
    projectPath: metadata.projectPath,
    state: 'owned',
    openedProjectWindow: true,
    port: metadata.port,
    host: { pid: 43, executable: 'selected-backend', started: 'current-host-start' },
    createdAt: new Date(expected.startedAt).toISOString(),
    updatedAt: new Date(expected.startedAt).toISOString(),
  }
  mocks.readRecord.mockResolvedValue(record)
  return { metadata, expected, record }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('fresh DevTools window evidence', () => {
  it('accepts the current owned window and returns only its non-secret launch evidence', async () => {
    const { metadata, expected, record } = createFixture()
    expect(await assertFreshDevtoolsWindow(metadata, expected)).toEqual({ openedProjectWindow: true, createdAt: record.createdAt, state: 'owned' })
    expect(mocks.readRecord).toHaveBeenCalledExactlyOnceWith(metadata.managedProject.journalPath, metadata.managedProject.id)
  })

  it('compares normalized project paths', async () => {
    const { metadata, expected, record } = createFixture()
    metadata.projectPath = `${expected.projectPath}${path.sep}child${path.sep}..`
    record.projectPath = `${expected.projectPath}${path.sep}.`
    expect(await assertFreshDevtoolsWindow(metadata, expected)).toMatchObject({ state: 'owned' })
  })

  it('rejects missing ownership metadata before reading any journal', async () => {
    const { metadata, expected } = createFixture()
    await expect(assertFreshDevtoolsWindow({ ...metadata, managedProject: undefined }, expected)).rejects.toThrow('ownership receipt')
    expect(mocks.readRecord).not.toHaveBeenCalled()
  })

  it('preserves a missing journal receipt failure', async () => {
    const { metadata, expected } = createFixture()
    const error = new Error('receipt not found')
    mocks.readRecord.mockRejectedValue(error)
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toBe(error)
  })

  it.each(['borrowed', 'released', 'closing', 'failed', 'starting', 'unconfirmed'] as const)('rejects a %s window', async (state) => {
    const { metadata, expected, record } = createFixture()
    record.state = state
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('newly opened and owned')
  })

  it.each([false, undefined])('rejects an owned record without a true opened-window receipt: %s', async (openedProjectWindow) => {
    const { metadata, expected, record } = createFixture()
    record.openedProjectWindow = openedProjectWindow
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('newly opened and owned')
  })

  it('rejects a receipt without a confirmed host identity', async () => {
    const { metadata, expected, record } = createFixture()
    delete record.host
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('confirmed host identity')
  })

  it.each(['dispatched', 'acknowledged'])('rejects an owned window whose close was %s', async (stage) => {
    const { metadata, expected, record } = createFixture()
    if (stage === 'acknowledged') {
      record.closeAcknowledgedAt = record.createdAt
    }
    else {
      record.windowClose = {
        protocol: 'wechat-devtools-window-close-trace-v1',
        profileDir: record.target.profileDir,
        productVersion: '1.0.0',
        capturedAt: record.createdAt,
        dispatchedAt: record.createdAt,
        cursors: [{ name: 'host.log', identity: '1:2', offset: 0, anchor: 'a'.repeat(64), skipPartialLine: false }],
        calls: [],
      }
    }
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('must not have started closing')
  })

  it.each(['old', 'invalid'])('rejects an %s creation timestamp', async (kind) => {
    const { metadata, expected, record } = createFixture()
    record.createdAt = kind === 'old' ? new Date(expected.startedAt - 1).toISOString() : 'not-a-timestamp'
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('created during this launch')
  })

  it.each(['metadata', 'record'])('rejects another project in %s', async (source) => {
    const { metadata, expected, record } = createFixture()
    const changed = source === 'metadata' ? metadata : record
    changed.projectPath = path.resolve('other-project')
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('project must match')
  })

  it('rejects a port that differs from the ownership receipt', async () => {
    const { metadata, expected, record } = createFixture()
    record.port = metadata.port + 1
    await expect(assertFreshDevtoolsWindow(metadata, expected)).rejects.toThrow('port must match')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects a non-finite launch start time: %s', async (startedAt) => {
    const { metadata, expected } = createFixture()
    await expect(assertFreshDevtoolsWindow(metadata, { ...expected, startedAt })).rejects.toThrow('finite launch start time')
    expect(mocks.readRecord).not.toHaveBeenCalled()
  })
})
