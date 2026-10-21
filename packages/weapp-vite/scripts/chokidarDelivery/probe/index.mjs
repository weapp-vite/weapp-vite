import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createFixture, verifyPublicResolution } from './fixture.mjs'
import { instrumentNative } from './native.mjs'
import { closeOwner } from './public.mjs'
import { createRecoveryFailureObserver, describePublicError } from './recoveryFailure.mjs'
import { exerciseScenario, nonApplicableReason, scenarios } from './scenarios.mjs'
import { createDeliveryTrace } from './trace.mjs'

const describeError = error => ({ name: error?.name, code: error?.code, message: String(error), stack: error?.stack })

/** 每个 worker 都从全新 npm consumer fixture 进入公开运行图，不复用前案的缓存。 */
export async function runPublicScenario(id, consumerRoot) {
  const scenario = scenarios.find(item => item.id === id)
  assert(scenario, `Unknown public consumer scenario: ${id}`)
  assert.equal(nonApplicableReason(scenario, process.platform), undefined)
  const root = await mkdtemp(path.join(consumerRoot, 'projects', `${id}-`))
  const result = { id, pid: process.pid, platform: process.platform, fixture: root, status: 'failed', evidence: {}, cleanup: { nativeCleanupConfirmed: false, deletedFixture: false, forcedNativeCloses: [], errors: [] } }
  const owners = []
  const errors = []
  const recoveryFailure = createRecoveryFailureObserver()
  let instrumentation
  let trace
  let injectedError
  try {
    await createFixture(root)
    result.fixtureInputs = await Promise.all(['vite.config.mjs', 'package.json', 'project.config.json', 'src/app.js', 'src/app.json', 'src/pages/index/index.js', 'src/pages/index/index.json', 'src/pages/index/index.wxml', 'src/shared/marker.txt', 'src/reborn/marker.txt'].map(async (file) => {
      const contents = await readFile(path.join(root, file))
      return { file, bytes: contents.length, sha256: createHash('sha256').update(contents).digest('hex') }
    }))
    result.resolution = verifyPublicResolution(consumerRoot)
    const target = path.join(root, 'src/reborn')
    injectedError = Object.assign(new Error('Injected native directory registration EPERM'), { code: 'EPERM', syscall: 'watch', path: target })
    trace = createDeliveryTrace(root, consumerRoot, injectedError)
    instrumentation = instrumentNative(root, ['shared', 'polling-handoff'].includes(scenario.kind) ? undefined : { target, missing: scenario.kind === 'recovery' || scenario.missing, error: injectedError }, trace)
    await trace.installChokidar()
    trace.record('scenario.enter', { id })
    await exerciseScenario({ scenario, root, owners, errors, instrumentation, injectedError, recoveryFailure, evidence: result.evidence })
    trace.record('scenario.completed', { id })
    result.status = 'passed'
  }
  catch (error) {
    trace?.record('scenario.failed', { error: trace.error(error) })
    result.bodyError = { ...describeError(error), originalInjectedError: error === injectedError }
    result.recoveryFailure = recoveryFailure.describe(error)
  }
  finally {
    for (const owner of owners) {
      try {
        await closeOwner(owner)
      }
      catch (error) { result.cleanup.errors.push(describeError(error)) }
    }
    if (instrumentation) {
      try {
        await instrumentation.assertClosed()
        result.cleanup.nativeCleanupConfirmed = true
      }
      catch (error) {
        result.cleanup.errors.push(describeError(error))
        try {
          result.cleanup.forcedNativeCloses = await instrumentation.emergencyClose()
        }
        catch (cleanupError) { result.cleanup.errors.push(describeError(cleanupError)) }
      }
      result.native = instrumentation.snapshot()
      instrumentation.restore()
    }
    else {
      result.cleanup.nativeCleanupConfirmed = true
    }
    if (result.cleanup.nativeCleanupConfirmed) {
      try {
        await rm(root, { recursive: true, force: true })
        await assert.rejects(access(root), { code: 'ENOENT' })
        result.cleanup.deletedFixture = true
      }
      catch (error) { result.cleanup.errors.push(describeError(error)) }
    }
    result.publicErrors = errors.map(error => describePublicError(error, injectedError))
    if (['recovery', 'shared', 'polling-handoff'].includes(scenario.kind) && result.status === 'passed') {
      try {
        assert.deepEqual(errors, [])
      }
      catch (error) {
        result.finalPublicError = describeError(error)
        result.status = 'failed'
      }
    }
    if (result.cleanup.errors.length || result.cleanup.forcedNativeCloses.length || !result.cleanup.deletedFixture) {
      result.status = 'failed'
    }
    trace?.record('cleanup.completed', { nativeCleanupConfirmed: result.cleanup.nativeCleanupConfirmed, deletedFixture: result.cleanup.deletedFixture })
    trace?.restore()
    if (trace?.enabled) {
      result.diagnostics = trace.snapshot()
    }
  }
  return result
}
