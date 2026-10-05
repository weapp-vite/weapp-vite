import type { ManagedWechatProjectRecord } from '../devtoolsProjectOwnership'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureManagedWechatProject } from './managedProjectGate'

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  records: vi.fn(),
  readRecord: vi.fn(),
  lock: vi.fn(),
  journal: vi.fn(),
  inspect: vi.fn(),
  installation: vi.fn(),
  write: vi.fn(),
}))
vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: async (run: () => Promise<unknown>) => await run() }))
vi.mock('./automator', () => ({ launchAutomator: mocks.launch }))
vi.mock('../devtoolsProjectOwnership/journal', () => ({
  resolveManagedJournal: mocks.journal,
  readManagedWechatProjectRecords: mocks.records,
  readManagedRecord: mocks.readRecord,
  writeManagedRecord: mocks.write,
  withManagedJournalLock: mocks.lock,
}))
vi.mock('../devtoolsProjectOwnership/host', async importOriginal => ({
  ...await importOriginal<typeof import('../devtoolsProjectOwnership/host')>(),
  inspectManagedProjectHost: mocks.inspect,
  assertManagedInstallation: mocks.installation,
}))

const target = { cliPath: 'selected-cli', appPath: 'selected-app', profileDir: 'selected-profile', installationId: 'selected', version: 'stable-test', channel: 'stable' as const }
const host = { pid: 100, executable: 'selected-backend', started: 'start-token' }
const projectPath = path.resolve('fixtures/managed-project')
const journalPath = path.resolve('fixtures/task-journal')

function record(overrides: Partial<ManagedWechatProjectRecord> = {}): ManagedWechatProjectRecord {
  return {
    schemaVersion: 1,
    id: 'owned-record',
    generation: 'generation',
    ownerToken: 'owner',
    ownerPid: 101,
    journalPath,
    target,
    projectPath,
    state: 'owned',
    openedProjectWindow: true,
    host,
    port: 12000,
    createdAt: 'created',
    updatedAt: 'updated',
    ...overrides,
  }
}

describe('managed project mutation gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.journal.mockReturnValue(journalPath)
    mocks.records.mockResolvedValue([])
    mocks.readRecord.mockImplementation(async (_path: string, id: string) => (await mocks.records() as ManagedWechatProjectRecord[]).find(item => item.id === id))
    mocks.lock.mockImplementation(async (_path: string, run: () => Promise<unknown>) => await run())
    mocks.inspect.mockResolvedValue(host)
    mocks.installation.mockResolvedValue(undefined)
    mocks.write.mockResolvedValue(undefined)
  })

  it('does not inspect or launch public operations without managed opt-in', async () => {
    mocks.journal.mockReturnValue(undefined)
    await expect(ensureManagedWechatProject(target, projectPath)).resolves.toBeUndefined()
    expect(mocks.records).not.toHaveBeenCalled()
    expect(mocks.installation).not.toHaveBeenCalled()
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it.each(['owned', 'borrowed'] as const)('reuses confirmed %s project without changing its automator port', async (state) => {
    const existing = record({ state, openedProjectWindow: state === 'owned' })
    mocks.records.mockResolvedValue([existing])
    await expect(ensureManagedWechatProject(target, projectPath)).resolves.toBe(existing)
    expect(mocks.inspect).toHaveBeenCalledExactlyOnceWith(target, existing.port)
    expect(mocks.installation).toHaveBeenCalledExactlyOnceWith(target)
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('obtains and verifies an official managed receipt before allowing the first mutation', async () => {
    const created = record()
    const program = { disconnect: vi.fn(), close: vi.fn() }
    mocks.launch.mockImplementation(async () => {
      mocks.records.mockResolvedValue([created])
      return program
    })
    const signal = new AbortController().signal
    await expect(ensureManagedWechatProject(target, projectPath, { signal, trustProject: true })).resolves.toBe(created)
    expect(mocks.launch).toHaveBeenCalledExactlyOnceWith({
      target,
      cliPath: target.cliPath,
      projectPath,
      runtimeProvider: 'devtools',
      preserveProjectRoot: true,
      persistAsDefaultSession: true,
      signal,
      trustProject: true,
      timeout: 120_000,
    })
    expect(program.disconnect).toHaveBeenCalledOnce()
    expect(program.close).not.toHaveBeenCalled()
    expect(mocks.inspect).toHaveBeenCalledExactlyOnceWith(target, created.port)
  })

  it.each(['starting', 'unconfirmed', 'closing', 'failed'] as const)('rejects any unresolved %s project before using even a matching confirmed record', async (state) => {
    mocks.records.mockResolvedValue([record(), record({ state, projectPath: path.resolve('fixtures/another-project') })])
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow('unresolved ownership')
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(mocks.inspect).not.toHaveBeenCalled()
  })

  it.each([
    { projectPath: path.resolve('fixtures/another-project') },
    { target: { ...target, installationId: 'different-installation' } },
    { target: { ...target, version: 'different-version' } },
    { state: 'released' as const },
  ])('does not borrow an unrelated or released record: %j', async (overrides) => {
    mocks.records.mockResolvedValue([record(overrides)])
    const failure = new Error('launch attempted')
    mocks.launch.mockRejectedValue(failure)
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toBe(failure)
    expect(mocks.launch).toHaveBeenCalledOnce()
    expect(mocks.inspect).not.toHaveBeenCalled()
  })

  it.each([
    { host: undefined },
    { port: undefined },
    { openedProjectWindow: false },
    { state: 'borrowed' as const, openedProjectWindow: true },
  ])('preserves an incomplete receipt as failed instead of reopening: %j', async (overrides) => {
    const existing = record(overrides)
    mocks.records.mockResolvedValue([existing])
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow('no confirmed window receipt')
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed' }))
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it.each(['missing', 'replaced'] as const)('blocks the lane when the recorded listener is %s', async (mode) => {
    mocks.records.mockResolvedValue([record()])
    if (mode === 'missing') {
      mocks.inspect.mockRejectedValue(new Error('listener missing'))
    }
    else {
      mocks.inspect.mockResolvedValue({ ...host, started: 'replacement-start' })
    }
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow(/listener (missing|changed)/)
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed' }))
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('rejects conflicting live ports rather than starting the agent again', async () => {
    mocks.records.mockResolvedValue([record(), record({ id: 'other', port: 12001 })])
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow('conflicting listener records')
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('does not revive a project released while a failed listener check waits for its journal lock', async () => {
    const existing = record()
    mocks.records.mockResolvedValue([existing])
    mocks.inspect.mockRejectedValue(new Error('listener missing'))
    mocks.lock.mockImplementation(async (_path: string, run: () => Promise<unknown>) => {
      existing.state = 'released'
      return await run()
    })
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow('listener missing')
    expect(mocks.readRecord).toHaveBeenCalledExactlyOnceWith(journalPath, existing.id)
    expect(mocks.write).not.toHaveBeenCalled()
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('rejects a changed selected installation before launching', async () => {
    mocks.installation.mockRejectedValue(new Error('installation changed'))
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow('installation changed')
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('requires the managed launch to leave a confirmed journal record', async () => {
    const disconnect = vi.fn()
    mocks.launch.mockResolvedValue({ disconnect })
    await expect(ensureManagedWechatProject(target, projectPath)).rejects.toThrow('without a confirmed task project')
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('rejects missing explicit project paths', async () => {
    await expect(ensureManagedWechatProject(target, ' ')).rejects.toThrow('explicit project path')
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('rejects an already-aborted mutation without opening or inspecting anything', async () => {
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    await expect(ensureManagedWechatProject(target, projectPath, { signal: controller.signal })).rejects.toThrow('cancelled')
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(mocks.records).not.toHaveBeenCalled()
  })
})
