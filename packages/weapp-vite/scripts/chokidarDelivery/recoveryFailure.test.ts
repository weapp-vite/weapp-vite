import assert from 'node:assert/strict'
import { beforeEach, it, vi } from 'vitest'
import { createRecoveryFailureObserver, describePublicError } from './probe/recoveryFailure.mjs'
import { exerciseScenario } from './probe/scenarios.mjs'

const harness = vi.hoisted(() => ({
  callbacks: 'original' as 'original' | 'different' | 'extra' | 'none',
  outputError: undefined as Error | undefined,
  outputs: [] as unknown[][],
}))

let injectedError: Error & { code: string }

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn(), rm: vi.fn() }))
vi.mock('./probe/public.mjs', () => ({
  async openPublicOwner(_kind: string, _root: string, _owners: unknown[], errors: Error[]) {
    if (harness.callbacks !== 'none') {
      errors.push(harness.callbacks === 'different' ? Object.assign(new Error('same code'), { code: 'EPERM' }) : injectedError)
    }
    if (harness.callbacks === 'extra') {
      errors.push(new Error('unexpected extra callback'))
    }
    return { kind: 'artifact' }
  },
  async assertOutput(...args: unknown[]) {
    harness.outputs.push(args.slice(1))
    if (harness.outputError) {
      throw harness.outputError
    }
  },
  closeOwner: vi.fn(),
}))

beforeEach(() => {
  injectedError = Object.assign(new Error('injected'), { code: 'EPERM' })
  harness.callbacks = 'original'
  harness.outputError = undefined
  harness.outputs.length = 0
})

function context() {
  return {
    scenario: { kind: 'recovery' },
    root: '.',
    owners: [],
    errors: [] as Error[],
    instrumentation: { injected: 1 },
    injectedError,
    evidence: {},
    recoveryFailure: createRecoveryFailureObserver(),
  }
}

async function caughtRecovery(ctx: ReturnType<typeof context>) {
  try {
    await exerciseScenario(ctx)
  }
  catch (error) {
    return error as Error & { code: string }
  }
  assert.fail('The unchanged zero-errors assertion must reject the callback')
}

it('完成原有三次输出断言后保留真实 ERR_ASSERTION，并以相同对象发布现场身份快照', async () => {
  const ctx = context()
  const error = await caughtRecovery(ctx)
  assert.equal(error.name, 'AssertionError')
  assert.equal(error.code, 'ERR_ASSERTION')
  assert.notEqual(error, injectedError)
  assert.deepEqual(harness.outputs, [
    ['reborn/marker.txt', 'recreated-directory'],
    ['reborn/marker.txt', 'changed-after-recovery'],
    ['reborn/marker.txt', null],
  ])
  assert.deepEqual(ctx.evidence, {})
  assert.deepEqual(ctx.recoveryFailure.describe(error), {
    stage: 'recovery-final-public-errors',
    publicErrors: [describePublicError(injectedError, injectedError)],
  })
  assert.equal(ctx.recoveryFailure.describe(new Error(error.message)), undefined)
})

it('前序输出断言失败不能获得最终零错误边界，且保留原错误对象', async () => {
  harness.outputError = new Error('actual output mismatch')
  const ctx = context()
  const error = await caughtRecovery(ctx)
  assert.equal(error, harness.outputError)
  assert.equal(ctx.recoveryFailure.describe(error), undefined)
})

it.each(['different', 'extra'] as const)('现场快照保留 %s 回调，不能把同码异对象或额外错误归成原始注入', async (callbacks) => {
  harness.callbacks = callbacks
  const ctx = context()
  const error = await caughtRecovery(ctx)
  const observed = ctx.recoveryFailure.describe(error)
  assert.equal(observed.publicErrors.length, callbacks === 'extra' ? 2 : 1)
  assert.equal(observed.publicErrors[0].originalInjectedError, callbacks !== 'different')
})

it('成功路径仍要求零回调，现场快照不会因后续错误或同文案异常而伪造', async () => {
  harness.callbacks = 'none'
  const ctx = context()
  await exerciseScenario(ctx)
  assert.deepEqual(ctx.evidence, { injectedOnce: true, factoryCompleted: true, createEmitted: true, changeEmitted: true, deleteEmitted: true })
  ctx.errors.push(injectedError)
  assert.equal(ctx.recoveryFailure.describe(injectedError), undefined)
})

it('断言现场与最终错误列表独立，晚到回调不会改写已捕获的现场', async () => {
  const ctx = context()
  const error = await caughtRecovery(ctx)
  ctx.errors.push(new Error('late callback'))
  assert.equal(ctx.recoveryFailure.describe(error).publicErrors.length, 1)
  assert.equal(ctx.errors.map(item => describePublicError(item, injectedError)).length, 2)
})
