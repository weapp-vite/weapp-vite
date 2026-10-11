import type { LifecycleStep, OwnedSession } from './context'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV, MANAGED_PROJECT_MAX_WINDOWS_ENV, readManagedWechatProjectRecords } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createDevtoolsProjectJournal } from '../../utils/devtoolsProcessOwnership'
import { preflightSelectedWechatDevtools, readDevtoolsVersionPolicy } from '../../utils/devtoolsSelection'
import { assertJournalReleased, assertSessionReleased, createLifecycleProject, errorText, openLifecycleSession, readBaseFixtureConfiguration, recordStep, REPO_ROOT, sessionEvidence } from './context'
import { checkKilledNestedRunner } from './nestedRunner'
import { checkCancellationAfterReceipt, checkMultipleWindows } from './scenarios'
import { checkKilledWorker } from './worker'

export async function runLifecycleChecks(signal: AbortSignal, scriptPath: string) {
  const temporaryRoot = path.join(REPO_ROOT, '.tmp')
  await fs.mkdir(temporaryRoot, { recursive: true })
  const runDirectory = await fs.mkdtemp(path.join(temporaryRoot, 'devtools-project-lifecycle-'))
  const reportPath = path.join(runDirectory, 'report.json')
  const previousJournal = process.env[MANAGED_PROJECT_JOURNAL_ENV]
  const previousMaxWindows = process.env[MANAGED_PROJECT_MAX_WINDOWS_ENV]
  const journalPath = await createDevtoolsProjectJournal(previousJournal || runDirectory)
  const steps: LifecycleStep[] = []
  const sessions: OwnedSession[] = []
  const errors: unknown[] = []
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), status: 'running', journalPath, steps }
  process.env[MANAGED_PROJECT_JOURNAL_ENV] = journalPath
  // A/B 与 protected/nested 场景刻意验证两个窗口的独立归属，子进程继承相同上限。
  process.env[MANAGED_PROJECT_MAX_WINDOWS_ENV] = '2'
  process.stdout.write(`[devtools-lifecycle] report: ${reportPath}\n`)
  try {
    await withMachineE2ELease(async (lease) => {
      try {
        signal.throwIfAborted()
        const fixture = await readBaseFixtureConfiguration()
        report.expectedSdkVersion = fixture.sdkVersion
        const target = await recordStep(steps, 'selected-IDE-preflight', preflightSelectedWechatDevtools)
        assert(target.version)
        report.target = target
        report.versionPolicy = readDevtoolsVersionPolicy()
        const projects: string[] = []
        for (const name of ['A', 'B', 'worker', 'cancellation', 'nested-runner', 'nested-protected']) {
          projects.push(await createLifecycleProject(runDirectory, name, fixture))
        }
        const common = { target, sdkVersion: fixture.sdkVersion, journalPath, steps, sessions, signal }
        await recordStep(steps, 'worker-SIGKILL-and-journal-recovery', () => checkKilledWorker({
          projectPath: projects[2]!,
          cliPath: target.cliPath,
          sdkVersion: fixture.sdkVersion,
          selectedVersion: target.version!,
          scriptPath,
          journalPath,
          runDirectory,
          signal,
        }))
        let protectedSession: OwnedSession | undefined
        await recordStep(steps, 'open-nested-runner-protected-project', async () => {
          protectedSession = await openLifecycleSession(target, projects[5]!, fixture.sdkVersion, signal)
          sessions.push(protectedSession)
          return sessionEvidence(protectedSession)
        })
        assert(protectedSession)
        await recordStep(steps, 'nested-runner-SIGKILL-and-descendant-recovery', () => checkKilledNestedRunner({
          lease,
          target,
          protectedSession: protectedSession!,
          projectPath: projects[4]!,
          cliPath: target.cliPath,
          sdkVersion: fixture.sdkVersion,
          selectedVersion: target.version!,
          scriptPath,
          journalPath,
          runDirectory,
          signal,
        }))
        await recordStep(steps, 'close-nested-runner-protected-project', async () => {
          await protectedSession!.program.close()
          return await assertSessionReleased(protectedSession!)
        })
        await recordStep(steps, 'cancel-after-durable-receipt', () => checkCancellationAfterReceipt({ ...common, projectPath: projects[3]! }))
        await checkMultipleWindows({ ...common, projectA: projects[0]!, projectB: projects[1]! })
      }
      catch (error) {
        errors.push(error)
      }
      finally {
        for (const session of sessions) {
          try {
            await session.program.close()
          }
          catch (error) {
            errors.push(error)
          }
        }
        try {
          await recordStep(steps, 'final-owned-project-cleanup', async () => {
            await cleanupManagedWechatProjects({ journalPath, scope: 'journal' })
            return await assertJournalReleased(journalPath)
          })
        }
        catch (error) {
          errors.push(error)
        }
      }
    })
  }
  catch (error) {
    errors.push(error)
  }
  finally {
    if (previousMaxWindows === undefined) {
      delete process.env[MANAGED_PROJECT_MAX_WINDOWS_ENV]
    }
    else {
      process.env[MANAGED_PROJECT_MAX_WINDOWS_ENV] = previousMaxWindows
    }
    if (previousJournal === undefined) {
      delete process.env[MANAGED_PROJECT_JOURNAL_ENV]
    }
    else {
      process.env[MANAGED_PROJECT_JOURNAL_ENV] = previousJournal
    }
    try {
      report.finalJournal = await readManagedWechatProjectRecords(journalPath)
    }
    catch (error) {
      errors.push(error)
    }
    report.endedAt = new Date().toISOString()
    if (signal.aborted && !errors.includes(signal.reason)) {
      errors.push(signal.reason)
    }
    report.interrupted = signal.aborted
    report.status = errors.length ? 'failed' : 'passed'
    report.errors = errors.map(errorText)
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`[devtools-lifecycle] ${report.status}: ${reportPath}\n`)
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Real DevTools project lifecycle verification failed')
  }
}
