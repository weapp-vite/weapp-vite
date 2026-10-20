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
  scenarios: [{ id: 'registered-owner-failure', kind: 'shared' }],
  nonApplicableReason: () => undefined,
  async exerciseScenario({ owners }: { owners: { kind: string, close: () => Promise<void> }[] }) {
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
      },
    })
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
