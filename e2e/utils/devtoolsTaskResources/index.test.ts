import type { MachineE2EChildScope } from '../../../packages/devtools-runtime/src/lease/machine'
import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'
import type { DevtoolsHostExitEvidence, DevtoolsHostLease } from '../devtoolsHostLifecycle'
import type { InstallationProcessSample, TaskResourceReport } from './types'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INHERITED_LEASE_ENV } from '../../../packages/devtools-runtime/src/lease/machineScope'
import { initializeManagedJournalScope } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'
import { quitClaimedDevtoolsHost } from '../devtoolsHostLifecycle'
import { createTaskResourceRecorder } from './index'
import { TASK_RESOURCE_EVENTS_ENV } from './wrappers'

const mocks = vi.hoisted(() => ({ journal: vi.fn(), processes: vi.fn(), inspectExited: vi.fn(), quit: vi.fn() }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async importOriginal => ({
  ...await importOriginal<typeof import('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>(),
  readManagedWechatProjectRecords: mocks.journal,
}))
vi.mock('./processes', () => ({ sampleInstallationProcesses: mocks.processes }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/processes', () => ({ inspectExitedWechatInstallation: mocks.inspectExited }))
vi.mock('../../../packages/weapp-ide-cli/src/cli/run-wechat-cli', () => ({ runWechatCliCommand: mocks.quit }))

let directory: string
let scopeToken: string
let options: Parameters<typeof createTaskResourceRecorder>[0]
const lease: DevtoolsHostLease = {
  target: { installationId: 'selected', cliPath: 'selected-cli', appPath: 'selected-app', profileDir: 'selected-profile', version: '2.0.0', channel: 'stable' },
  initial: { state: 'cold', identities: [] },
  claimedAt: '2026-10-19T00:00:00.000Z',
}
const hostExit: DevtoolsHostExitEvidence = {
  checkedAt: '2026-10-19T00:01:00.000Z',
  before: { state: 'selected', identities: [] },
  after: { state: 'cold', identities: [] },
  quitDispatched: true,
  exitedHostIdentities: [],
  installationInspection: {
    platform: 'darwin',
    installationRoot: 'selected-app',
    checkedAt: '2026-10-19T00:01:00.000Z',
    inspectedProcessCount: 10,
    kernelPathProcessCount: 10,
    textImageProcessCount: 0,
    exitedProcessCount: 0,
    zombieProcessCount: 0,
    selectedProcessCount: 0,
  },
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'task-resource-evidence-'))
  scopeToken = randomUUID()
  options = {
    runId: randomUUID(),
    commitSha: 'a'.repeat(40),
    suiteName: 'ide-exhaustive',
    taskLabel: 'owned-task',
    taskIndex: 0,
    journalPath: path.join(directory, 'journal'),
    reportRoot: path.join(directory, 'reports'),
    childScope: {
      environment: { [INHERITED_LEASE_ENV]: JSON.stringify({ scopes: [scopeToken] }) },
      seal: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      recoverStoppedDescendants: vi.fn().mockResolvedValue(undefined),
    } satisfies MachineE2EChildScope,
  }
  await fs.mkdir(options.journalPath)
  await initializeManagedJournalScope(options.journalPath)
  mocks.journal.mockResolvedValue([])
  mocks.processes.mockResolvedValue({ status: 'observed', value: {
    samplingStartedAt: '2026-10-20T00:00:00.000Z',
    samplingCompletedAt: '2026-10-20T00:00:00.100Z',
    installationRoot: path.join(directory, 'selected-installation.app'),
    installationRssBytes: { status: 'observed', value: 100 },
    verifiedMemberRssBytes: 100,
    processes: [],
    unclassifiedProcessCount: 0,
    missingIdentityCount: 0,
    uninspectedNewProcessCount: 0,
    verifiedNewForeignProcessCount: 0,
    newSelectedProcessCount: 0,
    identityChangedProcessCount: 0,
    newProcesses: [],
    unclassifiedProcesses: [],
    missingIdentities: [],
    identityChangedProcesses: [],
    preAnchorExitedProcesses: [],
    inventoryRoundCount: 1,
    inventoryBudgetExhausted: false,
    fallbackBudgetExhausted: false,
    samplingBudgetMs: 10_000,
    rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
    semantics: 'point-in-time-rss-not-peak',
    coverage: 'selected-installation-inventory-and-descendants',
    atomicity: 'non-atomic-sysctl-identity-and-image-brackets; observed-continuity-does-not-prove-no-unobserved-exec',
  } satisfies InstallationProcessSample })
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

async function readReport(indexPath: string | undefined) {
  expect(indexPath).toBeTypeOf('string')
  return JSON.parse(await fs.readFile(indexPath!, 'utf8')) as TaskResourceReport
}

async function observe(ownedLease = lease) {
  const recorder = createTaskResourceRecorder(options)
  await recorder.initialize()
  await recorder.beforeTask(ownedLease)
  await recorder.beforeCleanup()
  return recorder
}

describe('per-task IDE resource attachment', () => {
  it('persists three boundaries and reuses existing host exit evidence without exposing lease credentials', async () => {
    const recorder = await observe()
    const result = await recorder.finish({ hostExit })
    const report = await readReport(result.indexPath)
    expect(report.snapshots.map(snapshot => snapshot.phase)).toEqual(['before-task', 'before-cleanup', 'after-cleanup'])
    expect(report.cleanup.host).toMatchObject({ status: 'succeeded', evidence: hostExit })
    expect(report.machineScopeSha256).toEqual([createHash('sha256').update(scopeToken).digest('hex')])
    expect(JSON.stringify(report)).not.toContain(scopeToken)
    expect(report.status).toBe('complete')
    expect(mocks.processes).toHaveBeenCalledExactlyOnceWith(lease.target)
    expect(report.snapshots[0]!.processes.status).toBe('unavailable')
    expect(report.windowUsage.sampledNativeWindowMaximum.status).toBe('unavailable')
  })

  it('accepts the real read-only cold-host cleanup evidence without requiring another quit', async () => {
    const coldLease: DevtoolsHostLease = {
      ...lease,
      target: {
        ...lease.target,
        profileDir: path.join(directory, 'cold-profile'),
        appPath: '/selected.app/Contents/Resources/app.asar',
      },
    }
    mocks.inspectExited.mockResolvedValueOnce(hostExit.installationInspection)
    const recorder = await observe(coldLease)
    const coldExit = await quitClaimedDevtoolsHost(coldLease)
    const result = await recorder.finish({ hostExit: coldExit })
    expect(await readReport(result.indexPath)).toMatchObject({
      status: 'complete',
      cleanup: { host: { status: 'succeeded', evidence: { before: { state: 'cold' }, after: { state: 'cold' }, quitDispatched: false, installationInspection: hostExit.installationInspection } } },
    })
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(coldLease.target)
    expect(mocks.quit).not.toHaveBeenCalled()
  })

  it('removes journal owner capabilities while retaining the domain window and port closure receipts', async () => {
    const now = new Date().toISOString()
    const ownerToken = randomUUID()
    mocks.journal.mockResolvedValue([{
      id: 'owned-record',
      ownerToken,
      createdAt: now,
      state: 'released',
      openedProjectWindow: true,
      releasedReason: 'project-closed',
      port: 12345,
      windowClose: { window: { nativeClosedAt: now, webContentsDestroyedAt: now } },
    }])
    const result = await (await observe()).finish({ hostExit })
    const report = await readReport(result.indexPath)
    expect(JSON.stringify(report)).not.toContain(ownerToken)
    expect(report.registeredPorts).toMatchObject({ status: 'observed', value: [{ recordId: 'owned-record', closureEvidence: 'domain-cleanup-return' }] })
    expect(report.status).toBe('complete')
  })

  it('reports an unused reservation without claiming the reserved port was closed', async () => {
    const now = new Date().toISOString()
    mocks.journal.mockResolvedValue([{
      id: 'unused-snapshot',
      generation: 'unused-generation',
      journalPath: options.journalPath,
      ownerToken: randomUUID(),
      createdAt: now,
      state: 'released',
      releasedReason: 'not-started',
      port: 12345,
      snapshot: { protocol: 'wechat-devtools-project-snapshot-v1', state: 'removed', sourceProjectPath: 'source', token: randomUUID() },
    }])
    const result = await (await observe()).finish({ hostExit })
    const report = await readReport(result.indexPath)
    expect(report.status).toBe('complete')
    expect(report.registeredPorts).toMatchObject({ status: 'observed', value: [{ recordId: 'unused-snapshot', port: 12345, closureEvidence: 'unused-reservation' }] })
    expect(report.windowUsage.traceDerivedManagedOverlapUpperBound).toEqual({ status: 'observed', value: 0 })
    expect(report.windowUsage.gaps).toEqual([])
    expect(JSON.stringify(report.registeredPorts)).not.toContain('portClosed')
  })

  it('retains pending snapshot gaps after window closure and hashes its creation token', async () => {
    const now = new Date().toISOString()
    const token = randomUUID()
    mocks.journal.mockResolvedValue([{
      id: 'owned-snapshot',
      generation: 'snapshot-generation',
      journalPath: options.journalPath,
      ownerToken: randomUUID(),
      createdAt: now,
      state: 'released',
      openedProjectWindow: true,
      releasedReason: 'project-closed',
      port: 12345,
      windowClose: { window: { nativeClosedAt: now, webContentsDestroyedAt: now } },
      snapshot: { protocol: 'wechat-devtools-project-snapshot-v1', state: 'ready', sourceProjectPath: 'source', token, cleanupError: 'snapshot busy' },
    }])
    const result = await (await observe()).finish({ hostExit })
    const report = await readReport(result.indexPath)
    expect(report.status).toBe('incomplete')
    expect(report.errors.join('; ')).toContain('snapshot is not fully released')
    expect(JSON.stringify(report)).not.toContain(token)
    expect(report.snapshots[0]!.journal).toMatchObject({ status: 'observed', value: [{ snapshot: { tokenSha256: createHash('sha256').update(token).digest('hex') } }] })
    expect(report.registeredPorts).toMatchObject({ status: 'observed', value: [{ closureEvidence: 'domain-cleanup-return' }] })
  })

  it('hashes nested recovery scope identifiers while retaining the installation-exit receipts and evidence gaps', async () => {
    const now = new Date().toISOString()
    const recoveryScopeId = scopeToken
    const journalScopeId = (await initializeManagedJournalScope(options.journalPath)).scopeId
    const ownerToken = randomUUID()
    const recovered: ManagedWechatProjectRecord = {
      schemaVersion: 1,
      id: 'recovered-record',
      generation: randomUUID(),
      journalPath: options.journalPath,
      ownerToken,
      ownerPid: process.pid,
      target: lease.target,
      projectPath: path.join(directory, 'recovered-project'),
      state: 'released',
      openedProjectWindow: true,
      createdAt: now,
      updatedAt: now,
      port: 12345,
      releasedReason: 'installation-exited',
      installationExitRecovery: {
        protocol: 'wechat-devtools-installation-exit-v1',
        recoveredAt: now,
        recoveryScopeId,
        journalScopeId,
        journalRootPath: options.journalPath,
        installationId: lease.target.installationId,
        profileDir: lease.target.profileDir,
        previous: { state: 'unconfirmed', updatedAt: now, recordSha256: 'b'.repeat(64) },
        stoppedOwnerPids: [process.pid],
        closedPorts: [12345],
        processInspection: hostExit.installationInspection!,
      },
    }
    mocks.journal.mockResolvedValue([recovered])
    const result = await (await observe()).finish({ hostExit })
    const report = await readReport(result.indexPath)
    const serialized = JSON.stringify(report)
    for (const rawCapability of [ownerToken, recoveryScopeId, journalScopeId]) {
      expect(serialized).not.toContain(rawCapability)
    }
    for (const snapshot of report.snapshots) {
      expect(snapshot.journal).toMatchObject({ status: 'observed', value: [{ installationExitRecovery: {
        recoveryScopeSha256: createHash('sha256').update(recoveryScopeId).digest('hex'),
        journalScopeSha256: createHash('sha256').update(journalScopeId).digest('hex'),
        processInspection: hostExit.installationInspection,
      } }] })
      if (snapshot.journal.status === 'observed') {
        expect(snapshot.journal.value[0]!.installationExitRecovery).not.toHaveProperty('recoveryScopeId')
        expect(snapshot.journal.value[0]!.installationExitRecovery).not.toHaveProperty('journalScopeId')
      }
    }
    expect(report.registeredPorts).toMatchObject({ status: 'observed', value: [{ recordId: recovered.id, closureEvidence: 'installation-exit-recovery' }] })
    expect(report.status).toBe('incomplete')
    expect(report.errors.join('; ')).toContain('no complete native/webContents destruction pair')
    expect(recovered.installationExitRecovery).toMatchObject({ recoveryScopeId, journalScopeId })
  })

  it('marks required RSS, window, port, and host evidence gaps incomplete', async () => {
    mocks.processes.mockResolvedValue({ status: 'unavailable', reason: 'Kernel sample unavailable' })
    mocks.journal.mockResolvedValue([{ id: 'unconfirmed', createdAt: new Date().toISOString(), state: 'unconfirmed', port: 12345 }])
    const result = await (await observe()).finish({})
    const report = await readReport(result.indexPath)
    expect(report.status).toBe('incomplete')
    expect(result.errors.join('; ')).toMatch(/Kernel sample unavailable/)
    expect(result.errors.join('; ')).toMatch(/no complete native\/webContents destruction pair/)
    expect(result.errors.join('; ')).toMatch(/No existing domain cleanup proof/)
    expect(report.cleanup.host.status).toBe('not-attempted')
  })

  it('does not pass an existing event file to children after initialization fails', async () => {
    const first = createTaskResourceRecorder(options)
    await first.initialize()
    const file = first.environment[TASK_RESOURCE_EVENTS_ENV]!
    await fs.writeFile(file, 'preserve-existing-evidence')
    const second = createTaskResourceRecorder(options)
    await second.initialize()
    expect(second.environment[TASK_RESOURCE_EVENTS_ENV]).toBe('')
    await second.beforeTask(lease)
    await second.beforeCleanup()
    const result = await second.finish({ hostExit })
    expect(result.errors.join('; ')).toContain('initialization')
    expect(await fs.readFile(file, 'utf8')).toBe('preserve-existing-evidence')
  })

  it('preserves both cleanup errors and original event-write errors', async () => {
    const result = await (await observe()).finish({ scopeError: new Error('journal cleanup failed'), hostError: new Error('quit verification failed') }, ['event write failed'])
    const report = await readReport(result.indexPath)
    expect(report.cleanup).toMatchObject({ scope: { status: 'failed', error: 'journal cleanup failed' }, host: { status: 'failed', error: 'quit verification failed' } })
    expect(report.errors).toContain('event write failed')
    expect(report.status).toBe('incomplete')
  })

  it('keeps a missing final journal unavailable instead of presenting zero ports or overlap', async () => {
    const recorder = await observe()
    mocks.journal.mockRejectedValue(new Error('journal read failed'))
    const result = await recorder.finish({ hostExit })
    expect(await readReport(result.indexPath)).toMatchObject({
      status: 'incomplete',
      registeredPorts: { status: 'unavailable' },
      windowUsage: { traceDerivedManagedOverlapUpperBound: { status: 'unavailable' } },
    })
  })

  it('does not turn a physically missing or replaced task journal into an observed empty tree', async () => {
    const recorder = await observe()
    await fs.rm(options.journalPath, { recursive: true })
    const result = await recorder.finish({ hostExit })
    expect(await readReport(result.indexPath)).toMatchObject({ status: 'incomplete', journalScope: { status: 'unavailable' }, registeredPorts: { status: 'unavailable' } })

    options = { ...options, taskIndex: 1 }
    await fs.mkdir(options.journalPath)
    await initializeManagedJournalScope(options.journalPath)
    const replaced = await observe()
    await fs.rm(options.journalPath, { recursive: true })
    await fs.mkdir(options.journalPath)
    await initializeManagedJournalScope(options.journalPath)
    const replacedResult = await replaced.finish({ hostExit })
    expect(replacedResult.errors.join('; ')).toContain('scope identity is missing or changed')
  })

  it('does not erase previously observed records when their files disappear or change generation', async () => {
    mocks.journal.mockResolvedValue([{ id: 'observed-record', generation: 'first', journalPath: options.journalPath, createdAt: new Date().toISOString(), state: 'unconfirmed' }])
    const missing = await observe()
    mocks.journal.mockResolvedValue([])
    const missingResult = await missing.finish({ hostExit })
    expect(await readReport(missingResult.indexPath)).toMatchObject({
      status: 'incomplete',
      registeredPorts: { status: 'unavailable' },
      windowUsage: { traceDerivedManagedOverlapUpperBound: { status: 'unavailable' } },
    })
    expect(missingResult.errors.join('; ')).toContain('record disappeared or changed identity')

    options = { ...options, taskIndex: 1 }
    mocks.journal.mockResolvedValue([{ id: 'observed-record', generation: 'first', journalPath: options.journalPath, createdAt: new Date().toISOString(), state: 'unconfirmed' }])
    const changed = await observe()
    mocks.journal.mockResolvedValue([{ id: 'observed-record', generation: 'replacement', journalPath: options.journalPath, createdAt: new Date().toISOString(), state: 'released' }])
    expect((await changed.finish({ hostExit })).errors.join('; ')).toContain('record disappeared or changed identity')
  })
})
