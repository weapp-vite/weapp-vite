import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createFixture, verifyPublicResolution } from './fixture.mjs'
import { instrumentNative } from './native.mjs'
import { closeOwner } from './public.mjs'
import { exerciseScenario, nonApplicableReason, scenarios } from './scenarios.mjs'

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
  let instrumentation
  let injectedError
  try {
    await createFixture(root)
    result.resolution = verifyPublicResolution(consumerRoot)
    const target = path.join(root, 'src/reborn')
    injectedError = Object.assign(new Error('Injected native directory registration EPERM'), { code: 'EPERM', syscall: 'watch', path: target })
    instrumentation = instrumentNative(root, scenario.kind === 'shared' ? undefined : { target, missing: scenario.kind === 'recovery' || scenario.missing, error: injectedError })
    await exerciseScenario({ scenario, root, owners, errors, instrumentation, injectedError, evidence: result.evidence })
    result.status = 'passed'
  }
  catch (error) {
    result.bodyError = { ...describeError(error), originalInjectedError: error === injectedError }
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
    result.publicErrors = errors.map(error => ({ ...describeError(error), originalInjectedError: error === injectedError }))
    if (result.cleanup.errors.length || result.cleanup.forcedNativeCloses.length || !result.cleanup.deletedFixture) {
      result.status = 'failed'
    }
  }
  return result
}
