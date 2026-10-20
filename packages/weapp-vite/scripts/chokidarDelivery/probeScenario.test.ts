import type { createRecoveryFailureObserver } from './probe/recoveryFailure.mjs'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, it, vi } from 'vitest'
import { runPublicScenario } from './probe/index.mjs'

const harness = vi.hoisted(() => ({
  bodyError: new Error('body failed after owner registration'),
  closeError: undefined as Error | undefined,
  nativeError: undefined as Error | undefined,
  removalError: undefined as Error | undefined,
  lateError: undefined as Error | undefined,
  bodyPass: false,
  captureRecovery: false,
  replaceCapturedError: false,
  callback: 'none' as 'none' | 'original' | 'copy',
  throwInjected: false,
  lateCallback: 'none' as 'none' | 'original' | 'foreign',
  events: [] as string[],
  closeCalls: 0,
  native: { closeCalls: 0, closeEvents: 0 },
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    async rm(...args: Parameters<typeof actual.rm>) {
      harness.events.push('rm')
      if (harness.removalError) {
        throw harness.removalError
      }
      return actual.rm(...args)
    },
  }
})

vi.mock('./probe/fixture.mjs', () => ({
  weappOptions: {},
  createFixture: async () => { harness.events.push('fixture') },
  verifyPublicResolution: () => [],
  waitForFile: vi.fn(),
}))

vi.mock('./probe/native.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./probe/native.mjs')>()
  return {
    ...actual,
    instrumentNative: () => ({
      async assertClosed() {
        harness.events.push('assertClosed')
        if (harness.nativeError) {
          throw harness.nativeError
        }
        assert.deepEqual(harness.native, { closeCalls: 1, closeEvents: 1 })
      },
      async emergencyClose() {
        harness.events.push('emergencyClose')
        return ['src/owned']
      },
      snapshot: () => ({ handles: [{ file: 'src/owned', ...harness.native }] }),
      restore: () => { harness.events.push('restore') },
    }),
  }
})

vi.mock('./probe/scenarios.mjs', () => ({
  scenarios: [
    { id: 'registered-owner-failure', kind: 'shared' },
    { id: 'public-missing-watch-recovery', kind: 'recovery' },
    { id: 'public-still-exists-watch-error', kind: 'error' },
  ],
  nonApplicableReason: () => undefined,
  async exerciseScenario({ owners, errors, injectedError, recoveryFailure }: {
    owners: { kind: string, close: () => Promise<void> }[]
    errors: Error[]
    injectedError: Error
    recoveryFailure: ReturnType<typeof createRecoveryFailureObserver>
  }) {
    owners.push({
      kind: 'artifact',
      async close() {
        harness.events.push('close')
        harness.closeCalls++
        if (harness.native.closeCalls === 0) {
          harness.native.closeCalls++
          harness.native.closeEvents++
        }
        if (harness.closeError && harness.closeCalls === 2) {
          throw harness.closeError
        }
        if (harness.closeCalls === 1) {
          const late = harness.lateError ?? (harness.lateCallback === 'none' ? undefined : harness.lateCallback === 'original' ? injectedError : Object.assign(new Error('late unrelated error'), { code: 'EPERM' }))
          if (late) {
            errors.push(late)
          }
        }
      },
    })
    if (harness.callback !== 'none') {
      errors.push(harness.callback === 'original' ? injectedError : Object.assign(new Error(injectedError.message), { code: 'EPERM' }))
    }
    if (harness.throwInjected) {
      throw injectedError
    }
    if (harness.bodyPass) {
      return
    }
    if (harness.captureRecovery) {
      try {
        assert.deepEqual(errors, [])
      }
      catch (error) {
        recoveryFailure.capture(error, errors, injectedError)
        throw harness.replaceCapturedError ? harness.bodyError : error
      }
    }
    throw harness.bodyError
  },
}))

let consumerRoot: string
let chdir: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  harness.bodyError = new Error('body failed after owner registration')
  harness.closeError = undefined
  harness.nativeError = undefined
  harness.removalError = undefined
  harness.lateError = undefined
  harness.bodyPass = false
  harness.captureRecovery = false
  harness.replaceCapturedError = false
  harness.callback = 'none'
  harness.throwInjected = false
  harness.lateCallback = 'none'
  harness.events.length = 0
  harness.closeCalls = 0
  harness.native = { closeCalls: 0, closeEvents: 0 }
  consumerRoot = await mkdtemp(path.join(os.tmpdir(), 'chokidar-delivery-contract-'))
  await mkdir(path.join(consumerRoot, 'projects'))
  chdir = vi.spyOn(process, 'chdir').mockImplementation(() => {
    throw new Error('The public probe must preserve its startup cwd')
  })
})

afterEach(async () => {
  chdir.mockRestore()
  harness.removalError = undefined
  await rm(consumerRoot, { recursive: true, force: true })
})

function assertBodyError(result: Awaited<ReturnType<typeof runPublicScenario>>) {
  assert.equal(result.bodyError.message, String(harness.bodyError))
  assert.equal(result.bodyError.stack, harness.bodyError.stack)
  assert.equal(result.bodyError.originalInjectedError, false)
  assert.equal(result.status, 'failed')
  assert.equal(chdir.mock.calls.length, 0)
}

it('owner 登记后原 body error 保留，cwd 不变且原生句柄严格幂等收尾', async () => {
  const cwd = process.cwd()
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assertBodyError(result)
  assert.equal(process.cwd(), cwd)
  assert.equal(harness.closeCalls, 2)
  assert.deepEqual(harness.events, ['fixture', 'close', 'close', 'assertClosed', 'restore', 'rm'])
  assert.deepEqual(result.native.handles, [{ file: 'src/owned', closeCalls: 1, closeEvents: 1 }])
  assert.deepEqual(result.cleanup, { nativeCleanupConfirmed: true, deletedFixture: true, forcedNativeCloses: [], errors: [] })
})

it('重复公开关闭失败与首个 body error 分别保留，不能改记通过', async () => {
  harness.closeError = new Error('repeated close failed')
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assertBodyError(result)
  assert.equal(harness.closeCalls, 2)
  assert.equal(result.cleanup.errors.length, 1)
  assert.equal(result.cleanup.errors[0].message, String(harness.closeError))
  assert.equal(result.cleanup.nativeCleanupConfirmed, true)
  assert.equal(result.cleanup.deletedFixture, true)
})

it('原生关闭确认不替代 fixture 删除证据，EBUSY 保留且不重试', async () => {
  harness.removalError = Object.assign(new Error('fixture is busy'), { code: 'EBUSY' })
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assertBodyError(result)
  assert.equal(result.cleanup.nativeCleanupConfirmed, true)
  assert.equal(result.cleanup.deletedFixture, false)
  assert.equal(result.cleanup.errors.length, 1)
  assert.equal(result.cleanup.errors[0].code, 'EBUSY')
  assert.equal(harness.events.filter(event => event === 'rm').length, 1)
})

it('原生关闭未确认保留原错和精确应急记录，不删除 fixture', async () => {
  harness.nativeError = new Error('native close was not confirmed')
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assertBodyError(result)
  assert.equal(result.cleanup.nativeCleanupConfirmed, false)
  assert.equal(result.cleanup.deletedFixture, false)
  assert.deepEqual(result.cleanup.forcedNativeCloses, ['src/owned'])
  assert.equal(result.cleanup.errors.length, 1)
  assert.equal(result.cleanup.errors[0].message, String(harness.nativeError))
  assert.deepEqual(harness.events, ['fixture', 'close', 'close', 'assertClosed', 'emergencyClose', 'restore'])
})

it('外层只接受同一个局部 assertion 对象的边界记录，bodyError 保留 ERR_ASSERTION', async () => {
  harness.callback = 'original'
  harness.captureRecovery = true
  const result = await runPublicScenario('public-missing-watch-recovery', consumerRoot)
  assert.equal(result.bodyError.code, 'ERR_ASSERTION')
  assert.equal(result.bodyError.originalInjectedError, false)
  assert.equal(result.recoveryFailure.stage, 'recovery-final-public-errors')
  assert.equal(result.recoveryFailure.publicErrors[0].originalInjectedError, true)
  assert.equal(result.publicErrors[0].originalInjectedError, true)
  assert.equal(result.finalPublicError, undefined)
})

it('局部断言被另一错误替换时，外层保留实际错误并拒绝发布边界记录', async () => {
  harness.callback = 'original'
  harness.captureRecovery = true
  harness.replaceCapturedError = true
  const result = await runPublicScenario('public-missing-watch-recovery', consumerRoot)
  assertBodyError(result)
  assert.equal(result.recoveryFailure, undefined)
})

it('recovery body 成功后 cleanup 晚到错误使最终结果失败，且不伪造或覆盖 bodyError', async () => {
  harness.bodyPass = true
  harness.lateError = Object.assign(new Error('late cleanup callback'), { code: 'EPERM' })
  const result = await runPublicScenario('public-missing-watch-recovery', consumerRoot)
  assert.equal(result.status, 'failed')
  assert.equal(result.bodyError, undefined)
  assert.equal(result.recoveryFailure, undefined)
  assert.equal(result.finalPublicError.code, 'ERR_ASSERTION')
  assert.equal(result.publicErrors.length, 1)
  assert.equal(result.publicErrors[0].originalInjectedError, false)
  assert.deepEqual(result.cleanup, { nativeCleanupConfirmed: true, deletedFixture: true, forcedNativeCloses: [], errors: [] })
})

it('原 errorBoundary 场景仍允许既定唯一原始回调，不被 recovery 最终零错误门禁改变', async () => {
  harness.bodyPass = true
  harness.callback = 'original'
  const result = await runPublicScenario('public-still-exists-watch-error', consumerRoot)
  assert.equal(result.status, 'passed')
  assert.equal(result.finalPublicError, undefined)
  assert.equal(result.publicErrors.length, 1)
  assert.equal(result.publicErrors[0].originalInjectedError, true)
})

it('报告在对象仍可比较时保存原始 body 与 callback 身份', async () => {
  harness.throwInjected = true
  harness.callback = 'original'
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assert.equal(result.status, 'failed')
  assert.equal(result.bodyError.code, 'EPERM')
  assert.equal(result.bodyError.originalInjectedError, true)
  assert.equal(result.publicErrors.length, 1)
  assert.equal(result.publicErrors[0].originalInjectedError, true)
  assert.equal(result.publicErrors[0].code, 'EPERM')
  assert.equal(result.publicErrors[0].stack, result.bodyError.stack)
})

it.each(['original', 'copy'] as const)('callback=%s 不覆盖先前 body 失败或将同码副本标成原对象', async (callback) => {
  harness.callback = callback
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assertBodyError(result)
  assert.equal(result.publicErrors.length, 1)
  assert.equal(result.publicErrors[0].code, 'EPERM')
  assert.equal(result.publicErrors[0].originalInjectedError, callback === 'original')
})

it.each(['original', 'foreign'] as const)('清理期间迟到的 %s 错误保留最终数量与各自身份', async (lateCallback) => {
  harness.throwInjected = true
  harness.callback = 'original'
  harness.lateCallback = lateCallback
  const result = await runPublicScenario('registered-owner-failure', consumerRoot)
  assert.equal(result.bodyError.originalInjectedError, true)
  assert.equal(result.publicErrors.length, 2)
  assert.deepEqual(result.publicErrors.map(error => error.originalInjectedError), [true, lateCallback === 'original'])
  assert.equal(result.cleanup.nativeCleanupConfirmed, true)
  assert.equal(result.cleanup.deletedFixture, true)
})
