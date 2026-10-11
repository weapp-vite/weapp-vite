import type { Buffer } from 'node:buffer'
import type { MachineE2ELease } from '../../../../packages/devtools-runtime/src/lease/machine'
import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { OwnedSession } from '../context'
import type { WorkerOptions } from '../worker'
import type { NestedRunnerReady } from './evidence'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仅通过本次创建的 runner 句柄终止它，不终止子孙或共享 IDE。
import { execa } from 'execa'
import { MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createDevtoolsProjectJournal } from '../../../utils/devtoolsProcessOwnership'
import { cleanupDevtoolsCommandScope } from '../../../utils/devtoolsScopeCleanup'
import { assertJournalReleased, assertSessionReleased, readRuntimeEvidence, REPO_ROOT, START_TIMEOUT } from '../context'
import { assertNestedRunnerReady, assertNestedRunnerScopesCompleted, NESTED_READY_PREFIX, parseNestedRunnerReady, readNestedRunnerScopes } from './evidence'

interface NestedRunnerOptions extends WorkerOptions {
  lease: MachineE2ELease
  target: ResolvedWechatDevtoolsTarget
  protectedSession: OwnedSession
  scriptPath: string
  journalPath: string
  runDirectory: string
  signal: AbortSignal
}

async function assertProtectedSession(options: NestedRunnerOptions) {
  const session = options.protectedSession
  const record = (await readManagedWechatProjectRecords(session.journalPath)).find(value => value.id === session.id)
  assert(record?.state === 'owned', 'Nested recovery must preserve the other project window')
  assert.equal(record.projectPath, session.projectPath)
  assert.deepEqual(record.host, session.ownerHost)
  assert.equal(record.target.installationId, options.target.installationId)
  assert.equal(record.target.cliPath, options.cliPath)
  assert.equal(record.target.version, options.selectedVersion)
  return { id: session.id, state: record.state, info: await readRuntimeEvidence(options.target, session.program, options.sdkVersion) }
}

function spawnRunner(options: NestedRunnerOptions, environment: NodeJS.ProcessEnv, journalPath: string) {
  return execa(process.execPath, ['--import', 'tsx', options.scriptPath, '--nested-runner', JSON.stringify({
    projectPath: options.projectPath,
    cliPath: options.cliPath,
    sdkVersion: options.sdkVersion,
    selectedVersion: options.selectedVersion,
  })], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...environment, [MANAGED_PROJECT_JOURNAL_ENV]: journalPath },
    reject: false,
    killDescendants: false,
  })
}

/** 强退真实 suite runner 后由仍持有父能力的进程接管，独立验收 scope、窗口与共享宿主。 */
export async function checkKilledNestedRunner(options: NestedRunnerOptions) {
  options.signal.throwIfAborted()
  const runnerJournal = await createDevtoolsProjectJournal(options.journalPath)
  options.signal.throwIfAborted()
  const runnerScope = await options.lease.createChildScope({ cleanupKey: runnerJournal })
  const errors: unknown[] = []
  let killRequested = false
  let child: ReturnType<typeof spawnRunner> | undefined
  let exited = false
  let completion: Promise<Awaited<ReturnType<typeof spawnRunner>>> | undefined
  let readyTimer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  let evidence: NestedRunnerReady | undefined
  let scopesBefore: Awaited<ReturnType<typeof readNestedRunnerScopes>> | undefined
  let killed: { signal?: string, exitCode?: number } | undefined
  let protectedBefore: Awaited<ReturnType<typeof assertProtectedSession>> | undefined
  try {
    options.signal.throwIfAborted()
    protectedBefore = await assertProtectedSession(options)
    const ready = Promise.withResolvers<NestedRunnerReady>()
    child = spawnRunner(options, runnerScope.environment, runnerJournal)
    completion = child.then((result) => {
      exited = true
      return result
    }, (error: unknown) => {
      exited = child?.pid === undefined
      throw error
    })
    void completion.catch(() => {})
    let pendingOutput = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      pendingOutput += chunk.toString('utf8')
      const lines = pendingOutput.split(/\r?\n/)
      pendingOutput = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith(NESTED_READY_PREFIX)) {
          try {
            ready.resolve(parseNestedRunnerReady(line))
          }
          catch (error) {
            ready.reject(error)
          }
        }
      }
    })
    onAbort = () => ready.reject(options.signal.reason)
    options.signal.addEventListener('abort', onAbort, { once: true })
    if (options.signal.aborted) {
      onAbort()
    }
    readyTimer = setTimeout(() => ready.reject(new Error('Nested lifecycle runner did not report ready before its deadline')), START_TIMEOUT + 30_000)
    evidence = await Promise.race([
      ready.promise,
      completion.then(result => Promise.reject(new Error(`Nested lifecycle runner exited before ready: ${result.exitCode ?? result.signal}`))),
    ])
    scopesBefore = await readNestedRunnerScopes(runnerScope.environment)
    assertNestedRunnerReady(evidence, scopesBefore, runnerJournal, child.pid)
    const record = (await readManagedWechatProjectRecords(evidence.journalPath)).find(value => value.id === evidence!.id)
    assert.equal(record?.ownerPid, child.pid)
    assert.equal(record?.state, 'owned')
    assert.equal(record?.openedProjectWindow, true)
    assert.equal(record?.projectPath, options.projectPath)
    assert.equal(record?.target.installationId, options.target.installationId)
    assert.equal(record?.target.cliPath, options.cliPath)
    assert.equal(record?.target.version, options.selectedVersion)
    assert.deepEqual(record?.host, evidence.ownerHost)
    assert.equal(evidence.projectPath, options.projectPath)
    assert.equal(evidence.info.version, options.selectedVersion)
    assert.equal(evidence.info.SDKVersion, options.sdkVersion)
    assert(evidence.ownerHost && options.protectedSession.ownerHost, 'Both projects must retain their independently verified automator listener identities')
    options.signal.throwIfAborted()
    killRequested = child.kill('SIGKILL')
    assert(killRequested, 'Created nested runner must accept SIGKILL while alive')
  }
  catch (error) {
    errors.push(error)
  }
  finally {
    clearTimeout(readyTimer)
    if (onAbort) {
      options.signal.removeEventListener('abort', onAbort)
    }
    if (child && !exited && !killRequested) {
      try {
        killRequested = child.kill('SIGKILL')
      }
      catch (error) {
        errors.push(error)
      }
    }
    if (completion) {
      let exitTimer: ReturnType<typeof setTimeout> | undefined
      try {
        const result = await Promise.race([
          completion,
          new Promise<never>((_, reject) => {
            exitTimer = setTimeout(() => reject(new Error('Owned nested runner did not stop after SIGKILL; preserve its scope')), 10_000)
          }),
        ])
        killed = { signal: result.signal, exitCode: result.exitCode }
        await fs.writeFile(path.join(options.runDirectory, 'nested-runner.log'), `STDOUT\n${result.stdout}\nSTDERR\n${result.stderr}\n`)
        assert.equal(result.signal, 'SIGKILL', 'Nested recovery requires an actual SIGKILL exit')
      }
      catch (error) {
        errors.push(error)
      }
      finally {
        clearTimeout(exitTimer)
      }
    }
    try {
      assert(!child || exited, 'Owned nested runner exit remains unconfirmed; preserve its scope and journal')
      await cleanupDevtoolsCommandScope(runnerScope, runnerJournal)
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Nested runner recovery or evidence persistence did not complete')
  }
  assert(evidence && scopesBefore && killed && protectedBefore, 'Nested runner must provide complete crash and ownership evidence')
  const scopesAfter = await readNestedRunnerScopes(runnerScope.environment)
  assertNestedRunnerScopesCompleted(scopesBefore, scopesAfter)
  return {
    runner: evidence,
    killed,
    scopesBefore,
    scopesAfter,
    cleanup: await assertSessionReleased(evidence),
    journal: await assertJournalReleased(runnerJournal),
    protectedBefore,
    protectedAfter: await assertProtectedSession(options),
  }
}
