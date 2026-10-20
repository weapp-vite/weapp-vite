import type { MachineE2EChildScope } from '../../../packages/devtools-runtime/src/lease/machine'
import type { DevtoolsHostExitEvidence, DevtoolsHostLease } from '../devtoolsHostLifecycle'
import type { TaskResourceJournalRecord, TaskResourcePhase, TaskResourceReport, TaskResourceSnapshot } from './types'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { INHERITED_LEASE_ENV } from '../../../packages/devtools-runtime/src/lease/machineScope'
import { isManagedWechatProjectFullyReleased, MANAGED_PROJECT_MAX_WINDOWS_ENV, readManagedWechatProjectRecords } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { resolveManagedJournalScope } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'
import { ACCEPTANCE_ROOT, sanitizeAcceptanceValue } from '../../scripts/domAcceptanceReport/helpers'
import { sampleInstallationProcesses } from './processes'
import { summarizeTaskWindows } from './windows'
import { parseWrapperResourceEvents, summarizeWrapperResources, TASK_RESOURCE_EVENTS_ENV } from './wrappers'

interface ResourceRecorderOptions {
  runId: string
  commitSha: string
  suiteName: string
  taskLabel: string
  taskIndex: number
  journalPath: string
  childScope?: MachineE2EChildScope
  env?: Record<string, string>
  reportRoot?: string
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function scopeIds(scope?: MachineE2EChildScope) {
  const raw = scope?.environment[INHERITED_LEASE_ENV]
  if (!raw) {
    return []
  }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('scopes' in value) || !Array.isArray(value.scopes)
    || !value.scopes.every((id: unknown) => typeof id === 'string')) {
    throw new Error('Task resource evidence cannot identify its machine child scope.')
  }
  return (value.scopes as string[]).map(id => createHash('sha256').update(id).digest('hex'))
}

/** 三个现有边界保存被动证据；所有采样错误先记录，资源收尾由 runner 原流程负责。 */
export function createTaskResourceRecorder(options: ResourceRecorderOptions) {
  const safeSegment = (value: string) => value.replace(/[^\w-]/g, '_') || 'unknown'
  const directory = path.join(options.reportRoot ?? path.join(ACCEPTANCE_ROOT, 'docs/reports/dom-acceptance'), safeSegment(options.runId), 'task-resources', safeSegment(options.suiteName))
  const stem = String(options.taskIndex + 1).padStart(4, '0')
  const indexPath = path.join(directory, `${stem}.json`)
  const eventsPath = path.join(directory, `${stem}.wrapper-events.jsonl`)
  const budget = options.env?.[MANAGED_PROJECT_MAX_WINDOWS_ENV] ?? process.env[MANAGED_PROJECT_MAX_WINDOWS_ENV]
  const report: TaskResourceReport = {
    protocol: 'weapp-vite-ide-task-resources-v1',
    runId: options.runId,
    commitSha: options.commitSha,
    suiteName: options.suiteName,
    taskLabel: options.taskLabel,
    journalPath: options.journalPath,
    journalScope: { status: 'unavailable', reason: 'The task journal scope has not been read.' },
    machineScopeSha256: [],
    snapshots: [],
    windowUsage: { ...summarizeTaskWindows([], budget, new Date().toISOString()), traceDerivedManagedOverlapUpperBound: { status: 'unavailable', reason: 'The task journal has not been read.' } },
    wrapperResources: summarizeWrapperResources([]),
    registeredPorts: { status: 'unavailable', reason: 'The final task journal has not been read.' },
    cleanup: { scope: { status: 'not-attempted' }, host: { status: 'not-attempted' } },
    status: 'incomplete',
    errors: [],
  }
  let claimed: DevtoolsHostLease | undefined
  let initialized = false
  let journalIdentity: { rootPath: string, scopeId?: string } | undefined
  const observedRecords = new Map<string, { generation: string, journalPath: string }>()

  const capture = async (phase: TaskResourcePhase) => {
    const snapshot: TaskResourceSnapshot = {
      phase,
      sampledAt: new Date().toISOString(),
      systemMemory: { status: 'unavailable', reason: 'System memory was not sampled.' },
      processes: { status: 'unavailable', reason: 'RSS is sampled only at the before-cleanup boundary; host claim/exit evidence is recorded separately.' },
      journal: { status: 'unavailable', reason: 'Task journal was not read.' },
      ...(phase === 'before-task' && claimed ? { host: claimed.initial } : {}),
      ...(phase === 'after-cleanup' && report.cleanup.host.evidence ? { host: report.cleanup.host.evidence.after } : {}),
    }
    try {
      const freeBytes = os.freemem()
      const totalBytes = os.totalmem()
      if (!Number.isSafeInteger(freeBytes) || freeBytes < 0 || !Number.isSafeInteger(totalBytes) || totalBytes <= 0 || freeBytes > totalBytes) {
        throw new Error('Invalid system free/total memory sample.')
      }
      snapshot.systemMemory = { status: 'observed', value: { freeBytes, totalBytes } }
    }
    catch (error) {
      snapshot.systemMemory = { status: 'unavailable', reason: message(error) }
      report.errors.push(`${phase}: ${message(error)}`)
    }
    try {
      const before = await resolveManagedJournalScope(options.journalPath)
      const records = await readManagedWechatProjectRecords(options.journalPath)
      const after = await resolveManagedJournalScope(options.journalPath)
      if (!before.scopeId || after.scopeId !== before.scopeId || after.rootPath !== before.rootPath
        || (journalIdentity && (journalIdentity.scopeId !== before.scopeId || journalIdentity.rootPath !== before.rootPath))) {
        throw new Error('Task resource journal scope identity is missing or changed during observation.')
      }
      const currentRecords = new Map(records.map(record => [record.id, record]))
      for (const [id, previous] of observedRecords) {
        const current = currentRecords.get(id)
        if (!current || current.generation !== previous.generation || current.journalPath !== previous.journalPath) {
          throw new Error(`Previously observed task journal record disappeared or changed identity: ${id}.`)
        }
      }
      for (const record of records) {
        observedRecords.set(record.id, { generation: record.generation, journalPath: record.journalPath })
      }
      journalIdentity = before
      report.journalScope = { status: 'observed', value: { rootPath: before.rootPath, scopeSha256: createHash('sha256').update(before.scopeId).digest('hex') } }
      snapshot.journal = { status: 'observed', value: records.map(({ ownerToken: _ownerToken, installationExitRecovery, snapshot: managedSnapshot, ...rawRecord }) => {
        const record: TaskResourceJournalRecord = rawRecord
        if (managedSnapshot) {
          const { token, ...snapshotDetails } = managedSnapshot
          record.snapshot = { ...snapshotDetails, tokenSha256: createHash('sha256').update(token).digest('hex') }
        }
        if (!installationExitRecovery) {
          return record
        }
        const { recoveryScopeId, journalScopeId, ...recovery } = installationExitRecovery
        return {
          ...record,
          installationExitRecovery: {
            ...recovery,
            recoveryScopeSha256: createHash('sha256').update(recoveryScopeId).digest('hex'),
            journalScopeSha256: createHash('sha256').update(journalScopeId).digest('hex'),
          },
        }
      }) }
    }
    catch (error) {
      snapshot.journal = { status: 'unavailable', reason: message(error) }
      report.journalScope = { status: 'unavailable', reason: message(error) }
      report.errors.push(`${phase} journal: ${message(error)}`)
    }
    if (phase === 'before-cleanup' && claimed) {
      snapshot.processes = await sampleInstallationProcesses(claimed.target)
      if (process.platform === 'darwin') {
        if (snapshot.processes.status === 'unavailable') {
          report.errors.push(`before-cleanup process sample: ${snapshot.processes.reason}`)
        }
        else if (snapshot.processes.value.installationRssBytes.status === 'unavailable') {
          report.errors.push(`before-cleanup process sample: ${snapshot.processes.value.installationRssBytes.reason}`)
        }
      }
    }
    report.snapshots.push(snapshot)
  }

  return {
    get environment() { return { [TASK_RESOURCE_EVENTS_ENV]: initialized ? eventsPath : '' } },
    async initialize() {
      try {
        report.machineScopeSha256 = scopeIds(options.childScope)
        if (!report.machineScopeSha256.length) {
          report.errors.push('The machine child scope identity is unavailable.')
        }
      }
      catch (error) {
        report.errors.push(`machine child scope identity: ${message(error)}`)
      }
      try {
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(eventsPath, '', { flag: 'wx', mode: 0o600 })
        initialized = true
      }
      catch (error) {
        report.errors.push(`resource recorder initialization: ${message(error)}`)
      }
    },
    async beforeTask(lease: DevtoolsHostLease) {
      claimed = lease
      report.installation = lease.target
      await capture('before-task')
    },
    beforeCleanup: () => capture('before-cleanup'),
    async finish(cleanup: { scopeError?: unknown, hostError?: unknown, hostExit?: DevtoolsHostExitEvidence }, eventErrors: string[] = []) {
      report.cleanup.scope = cleanup.scopeError === undefined ? { status: 'succeeded' } : { status: 'failed', error: message(cleanup.scopeError) }
      report.cleanup.host = cleanup.hostError !== undefined
        ? { status: 'failed', error: message(cleanup.hostError) }
        : cleanup.hostExit ? { status: 'succeeded', evidence: cleanup.hostExit } : { status: 'not-attempted' }
      if (!claimed || !report.snapshots.some(snapshot => snapshot.phase === 'before-task')) {
        report.errors.push('The before-task cold host claim evidence is unavailable.')
      }
      if (!cleanup.hostExit) {
        report.errors.push('The existing host exit verification did not return evidence.')
      }
      else if (process.platform === 'darwin' && !cleanup.hostExit.installationInspection) {
        report.errors.push('No complete selected-installation exit inspection was returned by the existing host verification.')
      }
      await capture('after-cleanup')
      for (const phase of ['before-task', 'before-cleanup', 'after-cleanup'] as const) {
        if (!report.snapshots.some(snapshot => snapshot.phase === phase)) {
          report.errors.push(`Required resource observation is missing: ${phase}.`)
        }
      }
      const final = report.snapshots.at(-1)?.journal
      if (final?.status === 'observed' && report.snapshots.every(snapshot => snapshot.journal.status === 'observed')) {
        report.windowUsage = summarizeTaskWindows(final.value, budget, new Date().toISOString())
        report.errors.push(...report.windowUsage.gaps)
        for (const record of final.value) {
          if (record.snapshot && !isManagedWechatProjectFullyReleased(record)) {
            report.errors.push(`Managed project snapshot is not fully released: ${record.id} (${record.snapshot.state}).`)
          }
        }
        if (report.windowUsage.managedBudget.status === 'unavailable') {
          report.errors.push(report.windowUsage.managedBudget.reason)
        }
        report.registeredPorts = { status: 'observed', value: final.value.filter(record => record.port !== undefined).map(record => ({
          port: record.port!,
          recordId: record.id,
          state: record.state,
          closureEvidence: record.state === 'released' && record.releasedReason === 'not-started'
            && record.snapshot?.state === 'removed' && !record.snapshot.dispatchedAt && record.openedProjectWindow === undefined
            ? 'unused-reservation'
            : record.state === 'released' && record.releasedReason === 'borrowed'
              ? 'borrowed-preserved'
              : cleanup.scopeError === undefined && record.state === 'released' && record.releasedReason === 'project-closed'
                ? 'domain-cleanup-return'
                : record.state === 'released' && record.installationExitRecovery?.closedPorts.includes(record.port!) ? 'installation-exit-recovery' : 'not-proven',
        })) }
        for (const port of report.registeredPorts.value) {
          if (port.closureEvidence === 'not-proven') {
            report.errors.push(`No existing domain cleanup proof was returned for registered port ${port.port} (${port.recordId}).`)
          }
        }
      }
      report.errors.push(...eventErrors)
      if (cleanup.scopeError !== undefined || cleanup.hostError !== undefined) {
        report.errors.push('Existing resource cleanup did not complete; its original errors are retained in cleanup evidence.')
      }
      try {
        if (!initialized) {
          throw new Error('Resource event file was not initialized.')
        }
        report.wrapperResources = summarizeWrapperResources(parseWrapperResourceEvents(await fs.readFile(eventsPath, 'utf8')))
        report.errors.push(...report.wrapperResources.gaps)
      }
      catch (error) {
        report.errors.push(`wrapper resource evidence: ${message(error)}`)
      }
      report.status = report.errors.length ? 'incomplete' : 'complete'
      try {
        await fs.writeFile(indexPath, `${JSON.stringify(sanitizeAcceptanceValue(report), null, 2)}\n`, { flag: 'wx', mode: 0o600 })
        return { indexPath, errors: [...report.errors] }
      }
      catch (error) {
        return { errors: [...report.errors, `resource attachment write: ${message(error)}`] }
      }
    },
  }
}

export type TaskResourceRecorder = ReturnType<typeof createTaskResourceRecorder>
