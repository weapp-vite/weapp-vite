import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { it } from 'vitest'
import { isConfirmedBaselineRejection } from './negativeControl.mjs'
import { createRecoveryFailureObserver, describePublicError } from './probe/recoveryFailure.mjs'

function failedWorker() {
  const injectedError = Object.assign(new Error('injected native EPERM'), { code: 'EPERM' })
  const errors = [injectedError]
  const observer = createRecoveryFailureObserver()
  let bodyError
  let recoveryFailure
  try {
    try {
      assert.deepEqual(errors, [])
    }
    catch (error) {
      observer.capture(error, errors, injectedError)
      throw error
    }
  }
  catch (error) {
    const actual = error as Error & { code: string }
    bodyError = { name: actual.name, code: actual.code, message: String(actual), stack: actual.stack, originalInjectedError: actual === injectedError }
    recoveryFailure = observer.describe(error)
  }
  return {
    id: 'public-missing-watch-recovery',
    variant: 'baseline',
    code: 1,
    signal: null,
    timedOut: false,
    interrupted: false,
    status: 'failed',
    scope: 'completed',
    cleanupConfirmed: true,
    report: {
      id: 'public-missing-watch-recovery',
      platform: 'win32',
      status: 'failed',
      bodyError,
      recoveryFailure,
      publicErrors: errors.map(error => describePublicError(error, injectedError)),
      native: { injected: 1, handles: [{ file: '', closeCalls: 1, closeEvents: 1 }] },
      cleanup: { nativeCleanupConfirmed: true, deletedFixture: true, machineLeaseReleased: true, forcedNativeCloses: [], errors: [] },
    },
  }
}

function change(result: object, field: string, value: unknown) {
  const fields = field.split('.')
  let target = result as Record<string, unknown>
  for (const key of fields.slice(0, -1)) {
    target = target[key] as Record<string, unknown>
  }
  target[fields.at(-1)!] = value
  return result
}

function serialized(result: object): unknown {
  return JSON.parse(JSON.stringify(result)) as unknown
}

function directlyRejectedWorker() {
  const result = failedWorker()
  change(result, 'report.bodyError', { name: 'Error', code: 'EPERM', originalInjectedError: true })
  change(result, 'report.recoveryFailure', undefined)
  change(result, 'report.evidence', { injectedOnce: true, factoryCompleted: true, createEmitted: true, changeEmitted: true, deleteEmitted: true })
  return result
}

it('旧 predicate 拒绝已完成恢复但收到原始回调的真实断言形状；新边界保持 ERR_ASSERTION 原值', () => {
  const result = failedWorker()
  const originalBody = structuredClone(result.report.bodyError)
  const oldPredicate = result.status === 'failed' && result.code !== 0 && result.report.status === 'failed'
    && result.report.native.injected === 1 && result.report.bodyError?.originalInjectedError === true
    && result.report.bodyError.code === 'EPERM' && result.cleanupConfirmed
  assert.equal(oldPredicate, false)
  assert.equal(isConfirmedBaselineRejection(serialized(result)), true)
  assert.deepEqual(result.report.bodyError, originalBody)
  assert.equal(result.report.bodyError?.code, 'ERR_ASSERTION')
})

it('原始 EPERM 直接抛出分支保留，且仍须唯一原始回调与完整清理', () => {
  const result = directlyRejectedWorker()
  assert.equal(isConfirmedBaselineRejection(serialized(result)), true)
  change(result, 'report.publicErrors.0.originalInjectedError', false)
  assert.equal(isConfirmedBaselineRejection(serialized(result)), false)
})

it.each([
  ['id', 'shared-test-first'],
  ['variant', 'candidate'],
  ['report.id', 'shared-test-first'],
  ['report.platform', 'linux'],
  ['status', 'passed'],
  ['report.status', 'passed'],
  ['code', 0],
  ['code', 2],
  ['code', null],
  ['code', undefined],
  ['code', '1'],
  ['signal', 'SIGTERM'],
  ['timedOut', true],
  ['interrupted', true],
  ['launchError', 'failed to start'],
  ['scope', 'sealed'],
  ['cleanupConfirmed', false],
  ['cleanupError', { message: 'failed cleanup' }],
  ['sealError', { message: 'failed seal' }],
  ['supervisorError', { message: 'failed supervisor' }],
  ['error', { message: 'outer failure' }],
  ['report.error', { message: 'report failure' }],
  ['report.leaseError', { message: 'lease failure' }],
  ['report.finalPublicError', { code: 'ERR_ASSERTION' }],
  ['report.native.injected', 0],
  ['report.native.injected', 2],
  ['report.native.handles', []],
  ['report.native.handles', [null]],
  ['report.native.handles', [{ closeCalls: 1, closeEvents: 1 }]],
  ['report.native.handles', [{ file: 'owned', closeCalls: 2, closeEvents: 1 }]],
  ['report.native.handles', [{ file: 'owned', closeCalls: 1, closeEvents: 0 }]],
  ['report.cleanup.nativeCleanupConfirmed', false],
  ['report.cleanup.deletedFixture', false],
  ['report.cleanup.machineLeaseReleased', false],
  ['report.cleanup.forcedNativeCloses', ['forced']],
  ['report.cleanup.errors', [{ code: 'EBUSY' }]],
  ['report.publicErrors', []],
  ['report.publicErrors.0.originalInjectedError', false],
  ['report.publicErrors.0.code', 'EACCES'],
  ['report.publicErrors', [{ code: 'EPERM', originalInjectedError: true }, { code: 'EPERM', originalInjectedError: true }]],
] as const)('两个拒绝分支都要求完整边界与清理条件：%s = %j', (field, value) => {
  for (const result of [failedWorker(), directlyRejectedWorker()]) {
    assert.equal(isConfirmedBaselineRejection(serialized(change(result, field, value))), false)
  }
})

it.each([
  ['report.bodyError.code', 'EPERM'],
  ['report.bodyError.name', 'Error'],
  ['report.bodyError.originalInjectedError', true],
  ['report.recoveryFailure', undefined],
  ['report.recoveryFailure.stage', 'shared-final-public-errors'],
  ['report.recoveryFailure.publicErrors.0.originalInjectedError', false],
  ['report.recoveryFailure.publicErrors.0.code', 'EACCES'],
  ['report.recoveryFailure.publicErrors', []],
  ['report.recoveryFailure.publicErrors', [{ code: 'EPERM', originalInjectedError: true }, { code: 'EPERM', originalInjectedError: true }]],
] as const)('异步回调路径拒绝错误断言或错误现场：%s = %j', (field, value) => {
  assert.equal(isConfirmedBaselineRejection(serialized(change(failedWorker(), field, value))), false)
})

it('断言现场成立后 cleanup 又收到错误时仍拒绝，不能把晚到错误归零', () => {
  const result = failedWorker()
  const lateError = Object.assign(new Error('a different EPERM'), { code: 'EPERM' })
  result.report.publicErrors.push(describePublicError(lateError, new Error('not the injected object')))
  assert.equal(result.report.recoveryFailure.publicErrors.length, 1)
  assert.equal(isConfirmedBaselineRejection(serialized(result)), false)
})

it('真实复制整个 probe 后可由普通 Node 独立导入观察 helper，不依赖维护源码或测试 loader', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chokidar-probe-copy-'))
  try {
    await cp(new URL('./probe/', import.meta.url), path.join(root, 'probe'), { recursive: true })
    const helper = pathToFileURL(path.join(root, 'probe', 'recoveryFailure.mjs')).href
    const source = `
      import assert from 'node:assert/strict'
      const { createRecoveryFailureObserver, describePublicError } = await import(process.argv[1])
      const injected = Object.assign(new Error('copied probe'), { code: 'EPERM' })
      const observer = createRecoveryFailureObserver()
      let caught
      try { assert.deepEqual([injected], []) }
      catch (error) { caught = error; observer.capture(error, [injected], injected) }
      assert.equal(observer.describe(caught).publicErrors[0].originalInjectedError, true)
      assert.equal(observer.describe(new Error('unrelated')), undefined)
      assert.equal(describePublicError(new Error('other'), injected).originalInjectedError, false)
      console.log('copied-probe-helper-ok')
    `
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', source, helper], { cwd: root, encoding: 'utf8' })
    assert.equal(output.trim(), 'copied-probe-helper-ok')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
