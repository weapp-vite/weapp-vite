import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { bindScriptSetupExternalManagedProject, createScriptSetupExternalCleanup } from './scriptSetupExternalCleanup'

type CleanupOptions = ReturnType<Parameters<typeof createScriptSetupExternalCleanup>[0]>
type CleanupDependencies = NonNullable<Parameters<typeof createScriptSetupExternalCleanup>[1]>
type ProjectRecord = Awaited<ReturnType<CleanupDependencies['readRecords']>>[number]
const project = path.resolve('fixture-owned-project')
const taskJournalPath = path.resolve('fixture-task-journal')
const journalPath = path.join(taskJournalPath, 'children', 'fixture-child-journal')
const managed = { id: 'fixture-owner', journalPath, taskJournalPath }

function released(patch: Partial<ProjectRecord> = {}): ProjectRecord {
  return { id: managed.id, journalPath, projectPath: project, state: 'released', releasedReason: 'project-closed', ...patch }
}

function fixture(patch: Partial<CleanupOptions> = {}, records = [released()]) {
  const events: string[] = []
  const host = { close: vi.fn(async () => {
    events.push('close')
  }) }
  const dev = { stop: vi.fn(async () => {
    events.push('stop')
  }) }
  const options: CleanupOptions = { project, host, dev, launchAttempted: true, managed, ...patch }
  const dependencies = {
    readRecords: vi.fn(async (journal: string) => {
      expect(journal).toBe(taskJournalPath)
      events.push('read-journal')
      return records
    }),
    remove: vi.fn(async (target: string) => {
      expect(target).toBe(project)
      events.push('remove')
    }),
  }
  return { events, host, dev, dependencies, options, cleanup: createScriptSetupExternalCleanup(() => options, dependencies) }
}

afterEach(() => vi.unstubAllEnvs())

describe('external script managed teardown', () => {
  it('removes only after closing, stopping the watcher and checking the registered task tree', async () => {
    const task = fixture()
    await task.cleanup()
    expect(task.events).toEqual(['close', 'stop', 'read-journal', 'remove'])
  })

  it('stops the watcher independently and retains close failure as the first error', async () => {
    const task = fixture()
    const failure = new Error('original close failure')
    task.host.close.mockRejectedValueOnce(failure)
    await expect(task.cleanup()).rejects.toMatchObject({ cause: failure, errors: [failure] })
    expect(task.dev.stop).toHaveBeenCalledOnce()
    expect(task.dependencies.remove).not.toHaveBeenCalled()
  })

  it('preserves both close and watcher errors in order', async () => {
    const task = fixture()
    const closeFailure = new Error('original close failure')
    const stopFailure = new Error('original watcher failure')
    task.host.close.mockRejectedValueOnce(closeFailure)
    task.dev.stop.mockRejectedValueOnce(stopFailure)
    await expect(task.cleanup()).rejects.toMatchObject({ cause: closeFailure, errors: [closeFailure, stopFailure] })
    expect(task.dependencies.remove).not.toHaveBeenCalled()
  })

  it('preserves the directory while a watcher remains unresolved despite a closed owner', async () => {
    const task = fixture()
    const failure = new Error('watcher remains active')
    task.dev.stop.mockRejectedValueOnce(failure)
    await expect(task.cleanup()).rejects.toMatchObject({ cause: failure })
    expect(task.dependencies.readRecords).toHaveBeenCalledOnce()
    expect(task.dependencies.remove).not.toHaveBeenCalled()
  })

  it('keeps an attempted launch without a returned session for managed recovery', async () => {
    const task = fixture({ host: undefined, managed: undefined })
    await expect(task.cleanup()).rejects.toThrow(/cleanup incomplete/)
    expect(task.events).toEqual(['stop'])
  })

  it('does not treat a returned session without journal metadata as ownership evidence', async () => {
    const task = fixture({ managed: undefined })
    await expect(task.cleanup()).rejects.toThrow(/cleanup incomplete/)
    expect(task.events).toEqual(['close', 'stop'])
  })

  it.each([
    ['live owner', { state: 'owned' }],
    ['different id', { id: 'different-owner' }],
    ['different path', { projectPath: path.resolve('another-project') }],
    ['different child journal', { journalPath: path.join(taskJournalPath, 'children', 'another-child') }],
    ['borrowed window', { releasedReason: 'borrowed' }],
    ['unconfirmed native close', { releasedReason: undefined }],
  ] satisfies Array<[string, Partial<ProjectRecord>]>)('rejects %s as release evidence', async (_, patch) => {
    const task = fixture({}, [released(patch)])
    await expect(task.cleanup()).rejects.toThrow(/cleanup incomplete/)
    expect(task.dependencies.remove).not.toHaveBeenCalled()
  })

  it('checks unresolved child snapshots that still reference the owned source project', async () => {
    const snapshot = released({
      id: 'child-snapshot',
      journalPath: path.join(journalPath, 'children', 'nested-child'),
      projectPath: path.join(journalPath, 'snapshots', 'child-snapshot'),
      snapshot: { sourceProjectPath: project, state: 'ready' },
    })
    const task = fixture({}, [released(), snapshot])
    await expect(task.cleanup()).rejects.toThrow(/cleanup incomplete/)
    expect(task.dependencies.remove).not.toHaveBeenCalled()
    const recovered = fixture({}, [released(), { ...snapshot, snapshot: { ...snapshot.snapshot!, state: 'removed' } }])
    await recovered.cleanup()
    expect(recovered.dependencies.remove).toHaveBeenCalledOnce()
  })

  it('does not close or remove an unrelated manual project in the task tree', async () => {
    const task = fixture({}, [released({ releasedReason: 'installation-exited' }), released({
      id: 'unrelated-owner',
      projectPath: path.resolve('manual-project'),
      state: 'owned',
    })])
    await task.cleanup()
    expect(task.dependencies.remove).toHaveBeenCalledExactlyOnceWith(project)
    expect(task.host.close).toHaveBeenCalledOnce()
  })

  it('retains journal and filesystem failures instead of reporting cleanup success', async () => {
    for (const operation of ['readRecords', 'remove'] as const) {
      const task = fixture()
      const failure = new Error(`${operation} failure`)
      task.dependencies[operation].mockRejectedValueOnce(failure)
      await expect(task.cleanup()).rejects.toMatchObject({ cause: failure, errors: [failure] })
      if (operation === 'readRecords') {
        expect(task.dependencies.remove).not.toHaveBeenCalled()
      }
    }
  })

  it('cleans unlaunched and headless projects without consulting a DevTools journal', async () => {
    for (const host of [undefined, { close: vi.fn(async () => {}) }]) {
      const task = fixture({ launchAttempted: false, managed: undefined, host })
      await task.cleanup()
      expect(task.dependencies.readRecords).not.toHaveBeenCalled()
      expect(task.dependencies.remove).toHaveBeenCalledOnce()
    }
  })

  it('preserves a headless project if its VM could not close', async () => {
    const task = fixture({ launchAttempted: false, managed: undefined })
    task.host.close.mockRejectedValueOnce(new Error('VM close failure'))
    await expect(task.cleanup()).rejects.toThrow(/cleanup incomplete/)
    expect(task.dev.stop).toHaveBeenCalledOnce()
    expect(task.dependencies.remove).not.toHaveBeenCalled()
  })

  it('shares concurrent and repeated successful cleanup without redispatching resources', async () => {
    const task = fixture()
    const first = task.cleanup()
    expect(task.cleanup()).toBe(first)
    await first
    await task.cleanup()
    expect(task.host.close).toHaveBeenCalledOnce()
    expect(task.dev.stop).toHaveBeenCalledOnce()
    expect(task.dependencies.remove).toHaveBeenCalledOnce()
  })

  it('retains the first error while allowing a later retry of the failed resource only', async () => {
    const task = fixture()
    const failure = new Error('first close error')
    task.host.close.mockRejectedValueOnce(failure)
    const first = task.cleanup()
    await expect(first).rejects.toMatchObject({ cause: failure })
    await task.cleanup()
    await expect(first).rejects.toMatchObject({ cause: failure })
    expect(task.host.close).toHaveBeenCalledTimes(2)
    expect(task.dev.stop).toHaveBeenCalledOnce()
    expect(task.dependencies.remove).toHaveBeenCalledOnce()
  })

  it('retries failed directory deletion without closing or stopping already released resources', async () => {
    const task = fixture()
    const failure = new Error('directory deletion failed')
    task.dependencies.remove.mockRejectedValueOnce(failure)
    await expect(task.cleanup()).rejects.toMatchObject({ cause: failure })
    await task.cleanup()
    expect(task.host.close).toHaveBeenCalledOnce()
    expect(task.dev.stop).toHaveBeenCalledOnce()
    expect(task.dependencies.remove).toHaveBeenCalledTimes(2)
  })
})

describe('external script session metadata', () => {
  it('binds the exact owner from an explicitly read parent task tree', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, taskJournalPath)
    const readRecords = vi.fn(async () => [released()])
    expect(await bindScriptSetupExternalManagedProject(project, { projectPath: project, managedProject: managed }, readRecords)).toEqual(managed)
    expect(readRecords).toHaveBeenCalledExactlyOnceWith(taskJournalPath)
  })

  it('rejects missing explicit scope without relying on the process default journal', async () => {
    const readRecords = vi.fn(async () => [released()])
    for (const scope of [undefined, '']) {
      vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, scope)
      await expect(bindScriptSetupExternalManagedProject(project, { projectPath: project, managedProject: managed }, readRecords)).rejects.toThrow(/explicit task journal/)
    }
    expect(readRecords).not.toHaveBeenCalled()
  })

  it('rejects absent, mismatched and unregistered metadata while keeping the original journal failure', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, taskJournalPath)
    const readRecords = vi.fn(async () => [released()])
    for (const metadata of [
      { projectPath: project },
      { projectPath: path.resolve('another-project'), managedProject: managed },
      { projectPath: project, managedProject: { ...managed, id: 'another-owner' } },
      { projectPath: project, managedProject: { ...managed, journalPath: path.resolve('another-task-journal') } },
    ]) {
      await expect(bindScriptSetupExternalManagedProject(project, metadata, readRecords)).rejects.toThrow(/session/)
    }
    const failure = new Error('original task journal failure')
    readRecords.mockRejectedValueOnce(failure)
    await expect(bindScriptSetupExternalManagedProject(project, { projectPath: project, managedProject: managed }, readRecords)).rejects.toBe(failure)
  })
})
