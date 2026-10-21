import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine.ts'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../packages/weapp-ide-cli/src/index.ts'
import { createContext } from './context.mjs'
import { verifyFileBranches } from './fileBranches.mjs'
import { closeDuringScan, removeDuringStat, shared } from './lifecycle.mjs'
import { verifyPollingOwners } from './pollingOwners.mjs'
import { classify, recover } from './registration.mjs'
import { verifyRemoveCooldown } from './removeCooldown.mjs'
import { verifyReplacementRead } from './replacementRead.mjs'
import { installedChokidar } from './report.mjs'
import { nonApplicableReason, scenarios } from './scenarios.mjs'
import { verifySharedInode } from './sharedInode.mjs'
import { verifyLateSiblingError, verifyReboundSurvivor } from './sharedInodeBoundaries.mjs'
import { verifyStaleFileRead } from './staleFileRead.mjs'
import { bounded } from './support.mjs'

const args = process.argv.slice(2)
assert.equal(args.length, 2, 'Internal worker requires one scenario and its supervisor fixture')
const [scenarioId, fixtureRoot] = args
const scenario = scenarios.find(item => item.id === scenarioId)
assert.ok(scenario, `Unknown scenario: ${scenarioId}`)
assert.ok(path.isAbsolute(fixtureRoot))
assert.equal(nonApplicableReason(scenario, process.platform), undefined, 'Unsupported native branches are reported by the supervisor')
assert.ok(typeof MANAGED_PROJECT_JOURNAL_ENV === 'string' && MANAGED_PROJECT_JOURNAL_ENV)
assert.equal(process.env[MANAGED_PROJECT_JOURNAL_ENV], undefined, 'Ordinary workers cannot inherit a real IDE journal')
const installed = await installedChokidar()
let result

async function exercise(ctx) {
  const { scenario, root, watched, target, image, timeoutMs, open, ready, instrumentation, scenarioEvidence: evidence } = ctx
  const imported = await import(pathToFileURL(installed.entry).href)
  const chokidar = imported.default || imported
  const options = { chokidar, root, watched, target, image, timeoutMs, open, ready, instrumentation, evidence }
  if (scenario.kind === 'recover') {
    await recover(chokidar, ctx)
  }
  else if (scenario.kind === 'classify') {
    await classify(chokidar, ctx)
  }
  else if (scenario.kind === 'close') {
    await closeDuringScan(chokidar, ctx)
  }
  else if (scenario.kind === 'remove-during-stat') {
    await removeDuringStat(chokidar, ctx)
  }
  else if (scenario.kind === 'replacement-read') {
    await verifyReplacementRead({ ...options, heldRead: ctx.heldReplacementRead, arm: ctx.armReplacementRead })
  }
  else if (scenario.kind === 'remove-cooldown') {
    await verifyRemoveCooldown({ ...options, entryType: scenario.entryType })
  }
  else if (scenario.kind === 'stale-file-read') {
    await verifyStaleFileRead({ ...options, gate: ctx.staleFileReadGate })
  }
  else if (scenario.kind === 'file-branches') {
    await verifyFileBranches({ ...options, branch: scenario.branch })
  }
  else if (scenario.kind === 'polling-owners') {
    await verifyPollingOwners({ ...options, closeUpgrader: scenario.closeUpgrader })
  }
  else if (scenario.kind === 'shared-inode') {
    await verifySharedInode(options)
  }
  else if (scenario.kind === 'shared-inode-late-error') {
    await verifyLateSiblingError({ ...options, file: ctx.sharedBoundaryFile, gate: ctx.sharedStatGate })
  }
  else if (scenario.kind === 'shared-inode-survivor') {
    await verifyReboundSurvivor({ ...options, file: ctx.sharedBoundaryFile })
  }
  else { await shared(chokidar, ctx, scenario.kind === 'shared-failure') }
  if (scenario.kind !== 'close') {
    for (const owner of ctx.observations) {
      if (owner.readyRequired !== false) {
        assert.equal(owner.readyCount, 1, 'completed public owner emits ready exactly once')
      }
    }
  }
  for (const owner of ctx.observations) {
    if (owner.eventPhases.failures.length) {
      throw owner.eventPhases.failures[0]
    }
  }
}

try {
  await withMachineE2ELease(async (lease) => {
    assert.equal(lease.borrowed, true, 'Workers must borrow the supervisor machine scope')
    const root = await mkdtemp(path.join(fixtureRoot, 'scenario-'))
    process.stderr.write(`${JSON.stringify({ type: 'owned-temp-root', scenario: scenario.id, root })}\n`)
    const ctx = createContext(scenario, root)
    let bodyError
    const cleanupErrors = []
    let forcedNativeCloses = []
    let nativeCleanupConfirmed = false
    let listenerCleanupConfirmed = false
    let deletedTempRoot = false
    try {
      await ctx.prepare()
      ctx.install()
      await exercise(ctx)
    }
    catch (error) {
      bodyError = { name: error.name, message: error.message, stack: error.stack }
    }
    finally {
      for (const item of ctx.gates) {
        item.release.resolve()
      }
      ctx.staleFileReadGate.releaseAll()
      ctx.sharedStatGate.releaseAll()
      if (ctx.instrumentation) {
        ctx.instrumentation.markPublicClose()
        for (const owner of ctx.observations) {
          try {
            await bounded(owner.watcher.close(), 'final public owner close', ctx.timeoutMs)
            await bounded(owner.watcher.close(), 'final repeated public owner close', ctx.timeoutMs)
          }
          catch (error) { cleanupErrors.push(String(error)) }
        }
        const listenerCleanupErrors = []
        for (const owner of ctx.observations) {
          try {
            await owner.eventPhases.settle(ctx.timeoutMs)
          }
          catch (error) { listenerCleanupErrors.push(String(error)) }
        }
        cleanupErrors.push(...listenerCleanupErrors)
        listenerCleanupConfirmed = listenerCleanupErrors.length === 0
        try {
          await ctx.instrumentation.assertAllClosed(ctx.timeoutMs, scenario.kind.startsWith('shared-inode'))
          nativeCleanupConfirmed = true
        }
        catch (error) {
          cleanupErrors.push(String(error))
          try {
            forcedNativeCloses = await ctx.instrumentation.emergencyClose(ctx.timeoutMs)
          }
          catch (cleanupError) { cleanupErrors.push(String(cleanupError)) }
        }
        ctx.instrumentation.restore()
      }
      else {
        nativeCleanupConfirmed = true
        listenerCleanupConfirmed = true
      }
      if (nativeCleanupConfirmed && listenerCleanupConfirmed) {
        try {
          await rm(root, { recursive: true, force: true })
          await assert.rejects(access(root), { code: 'ENOENT' })
          deletedTempRoot = true
        }
        catch (error) { cleanupErrors.push(String(error)) }
      }
    }
    const listenerFailures = ctx.observations.flatMap(owner => owner.eventPhases.failures)
    const passed = !bodyError && !listenerFailures.length && cleanupErrors.length === 0 && forcedNativeCloses.length === 0 && deletedTempRoot
    result = {
      id: scenario.id,
      status: passed ? 'passed' : 'failed',
      installed: { version: installed.version, hashes: installed.hashes },
      simulationNotice: scenario.platform === 'native'
        ? 'Native host classification; not a replacement for Windows CI.'
        : `process.platform=${scenario.platform} classification with native host filesystem. This is not real Windows CI.`,
      bodyError,
      injected: ctx.injected,
      probeErrorCount: ctx.probeErrorCount,
      scenarioEvidence: ctx.scenarioEvidence,
      owners: ctx.observations.map(owner => ({
        readyCount: owner.readyCount,
        errors: owner.errors.map(error => ({ code: error.code, syscall: error.syscall, originalInjectedError: error === ctx.injectedError, message: error.message })),
        listenerFailures: owner.eventPhases.failures.map(error => ({ name: error?.name, code: error?.code, message: String(error?.message ?? error), stack: error?.stack })),
        pendingListeners: owner.eventPhases.pending,
        events: owner.events,
      })),
      native: ctx.instrumentation?.snapshot(),
      cleanup: { nativeCleanupConfirmed, listenerCleanupConfirmed, deletedTempRoot, cleanupErrors, forcedNativeCloses, machineLeaseReleased: false },
    }
  })
  result.cleanup.machineLeaseReleased = true
}
catch (error) {
  result ??= { id: scenario.id, cleanup: { machineLeaseReleased: false } }
  result.status = 'failed'
  result.leaseError = { message: String(error), stack: error?.stack }
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (result.status !== 'passed') {
  process.exitCode = 1
}
