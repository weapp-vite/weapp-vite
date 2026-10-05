import type { LifecycleStep, OwnedSession } from './devtoolsProjectLifecycle/context'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createDevtoolsProjectJournal } from '../utils/devtoolsProcessOwnership'
import { preflightSelectedWechatDevtools, readDevtoolsVersionPolicy } from '../utils/devtoolsSelection'
import { assertJournalReleased, createLifecycleProject, errorText, readBaseFixtureConfiguration, recordStep, REPO_ROOT } from './devtoolsProjectLifecycle/context'
import { checkCancellationAfterReceipt, checkMultipleWindows } from './devtoolsProjectLifecycle/scenarios'
import { checkKilledWorker, runLifecycleWorker } from './devtoolsProjectLifecycle/worker'
import { createSuiteSignalScope } from './suiteRunner/signals'

async function main(signal: AbortSignal) {
  const temporaryRoot = path.join(REPO_ROOT, '.tmp')
  await fs.mkdir(temporaryRoot, { recursive: true })
  const runDirectory = await fs.mkdtemp(path.join(temporaryRoot, 'devtools-project-lifecycle-'))
  const reportPath = path.join(runDirectory, 'report.json')
  const previousJournal = process.env[MANAGED_PROJECT_JOURNAL_ENV]
  const journalPath = await createDevtoolsProjectJournal(previousJournal || runDirectory)
  const steps: LifecycleStep[] = []
  const sessions: OwnedSession[] = []
  const errors: unknown[] = []
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), status: 'running', journalPath, steps }
  process.env[MANAGED_PROJECT_JOURNAL_ENV] = journalPath
  process.stdout.write(`[devtools-lifecycle] report: ${reportPath}\n`)
  try {
    await withMachineE2ELease(async () => {
      try {
        signal.throwIfAborted()
        const fixture = await readBaseFixtureConfiguration()
        report.expectedSdkVersion = fixture.sdkVersion
        const target = await recordStep(steps, 'selected-IDE-preflight', preflightSelectedWechatDevtools)
        assert(target.version)
        report.target = target
        report.versionPolicy = readDevtoolsVersionPolicy()
        const projects: string[] = []
        for (const name of ['A', 'B', 'worker', 'cancellation']) {
          projects.push(await createLifecycleProject(runDirectory, name, fixture))
        }
        const common = { target, sdkVersion: fixture.sdkVersion, journalPath, steps, sessions, signal }
        await recordStep(steps, 'worker-SIGKILL-and-journal-recovery', () => checkKilledWorker({
          projectPath: projects[2]!,
          cliPath: target.cliPath,
          sdkVersion: fixture.sdkVersion,
          selectedVersion: target.version!,
          scriptPath: fileURLToPath(import.meta.url),
          journalPath,
          runDirectory,
          signal,
        }))
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

try {
  if (process.argv[2] === '--worker') {
    await runLifecycleWorker(process.argv[3])
  }
  else {
    assert(process.argv.length === 2, 'Only the internal --worker option is supported')
    const signals = createSuiteSignalScope()
    try {
      await main(signals.signal)
    }
    finally {
      if (signals.exitCode !== undefined) {
        process.exitCode = signals.exitCode
      }
      signals.dispose()
    }
  }
}
catch (error) {
  process.stderr.write(`${errorText(error)}\n`)
  process.exitCode = process.exitCode || 1
}
