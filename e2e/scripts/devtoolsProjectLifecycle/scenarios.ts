import type { ManagedWechatProjectIntent } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { LifecycleStep, OwnedSession } from './context'
import assert from 'node:assert/strict'
import { startWechatIdeAgent } from '../../../packages/weapp-ide-cli/src/cli/agentStart'
import { beginManagedWechatProject, readManagedWechatProjectRecords } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { assertJournalReleased, assertOwnedWindowLimit, assertSessionReleased, openLifecycleSession, readRuntimeEvidence, recordStep, selectFreePort, sessionEvidence, START_TIMEOUT } from './context'
import { inspectListenerAncestors } from './diagnostics'

interface ScenarioOptions {
  target: ResolvedWechatDevtoolsTarget
  sdkVersion: string
  journalPath: string
  steps: LifecycleStep[]
  sessions: OwnedSession[]
  signal: AbortSignal
}

async function closeFailedIntent(intent: ManagedWechatProjectIntent, error: unknown): Promise<never> {
  const errors = [error]
  for (const cleanup of [() => intent.fail(error), () => intent.close()]) {
    try {
      await cleanup()
    }
    catch (cleanupError) {
      errors.push(cleanupError)
    }
  }
  throw errors.length === 1 ? error : new AggregateError(errors, 'Lifecycle start and cleanup failed')
}

export async function checkMultipleWindows(options: ScenarioOptions & { projectA: string, projectB: string }) {
  const { target, sdkVersion, journalPath, steps, sessions, signal } = options
  const open = async (name: string, projectPath: string) => {
    let session: OwnedSession | undefined
    await recordStep(steps, `open-${name}`, async () => {
      signal.throwIfAborted()
      await assertOwnedWindowLimit(journalPath, 1)
      session = await openLifecycleSession(target, projectPath, sdkVersion, signal)
      sessions.push(session)
      const journal = await assertOwnedWindowLimit(journalPath)
      return { ...sessionEvidence(session), journal, processDiagnostics: await inspectListenerAncestors(session.ownerHost) }
    })
    assert(session)
    return session
  }
  const a = await open('A', options.projectA)
  const b = await open('B', options.projectB)
  await recordStep(steps, 'borrow-A-and-close-borrowed-receipt', async () => {
    signal.throwIfAborted()
    const intent = await beginManagedWechatProject({ target, projectPath: a.projectPath, port: a.port, journalPath })
    assert(intent)
    try {
      const receipt = await startWechatIdeAgent({ target, projectPath: a.projectPath, port: a.port, timeout: START_TIMEOUT, trustProject: true, signal, onStarted: result => intent.confirm({ openedProjectWindow: result.openedProjectWindow, port: result.autoPort }) })
      assert.equal(receipt.openedProjectWindow, false, 'Starting A again must borrow its existing window')
      assert.equal(receipt.version, target.version)
      await intent.close()
      const record = (await readManagedWechatProjectRecords(journalPath)).find(value => value.id === intent.id)
      assert(record?.state === 'released' && record.releasedReason === 'borrowed')
      return { receipt, borrowedRecord: record, ownerStillResponds: await readRuntimeEvidence(target, a.program, sdkVersion) }
    }
    catch (error) {
      return await closeFailedIntent(intent, error)
    }
  })
  await recordStep(steps, 'disconnect-B-close-B-twice-preserve-A', async () => {
    b.program.disconnect()
    await b.program.close()
    await b.program.close()
    return { closedB: await assertSessionReleased(b), ownerAStillResponds: await readRuntimeEvidence(target, a.program, sdkVersion) }
  })
  await recordStep(steps, 'close-A', async () => {
    await a.program.close()
    return { closedA: await assertSessionReleased(a), journal: await assertJournalReleased(journalPath) }
  })
  let previous: OwnedSession | undefined
  for (let round = 1; round <= 2; round++) {
    const current = await open(`sequential-${round}`, options.projectA)
    await recordStep(steps, `close-sequential-${round}`, async () => {
      if (previous) {
        await previous.program.close()
      }
      const active = await readRuntimeEvidence(target, current.program, sdkVersion)
      await current.program.close()
      return { activeAfterPreviousClose: active, closed: await assertSessionReleased(current), journal: await assertJournalReleased(journalPath) }
    })
    previous = current
  }
}

/** 回执持久化完成后再取消，验证取消不会丢失窗口的关闭责任。 */
export async function checkCancellationAfterReceipt(options: ScenarioOptions & { projectPath: string }) {
  const { target, journalPath, projectPath, signal } = options
  signal.throwIfAborted()
  const port = await selectFreePort()
  const intent = await beginManagedWechatProject({ target, projectPath, port, journalPath })
  assert(intent)
  const cancellation = new AbortController()
  const reason = new Error('Lifecycle cancellation after durable official receipt')
  let confirmed = false
  try {
    await assert.rejects(startWechatIdeAgent({
      target,
      projectPath,
      port,
      timeout: START_TIMEOUT,
      trustProject: true,
      signal: AbortSignal.any([signal, cancellation.signal]),
      onStarted: async (receipt) => {
        await intent.confirm({ openedProjectWindow: receipt.openedProjectWindow, port: receipt.autoPort })
        assert(receipt.openedProjectWindow && receipt.version === target.version)
        confirmed = true
        cancellation.abort(reason)
      },
    }), error => error === reason)
    assert(confirmed, 'Cancellation must happen after the ownership receipt')
    await assertOwnedWindowLimit(journalPath)
    await intent.fail(reason)
    await intent.close()
    const record = (await readManagedWechatProjectRecords(journalPath)).find(value => value.id === intent.id)
    assert(record)
    return { confirmed, ownerHost: record.host, cleanup: await assertSessionReleased({ id: intent.id, journalPath, port }), journal: await assertJournalReleased(journalPath) }
  }
  catch (error) {
    return await closeFailedIntent(intent, error)
  }
}
