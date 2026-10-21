import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it, vi } from 'vitest'
import { createRecoveryFailureObserver } from './probe/recoveryFailure.mjs'
import { exerciseScenario } from './probe/scenarios.mjs'

const publicApi = vi.hoisted(() => ({
  openPublicOwner: vi.fn(),
  assertOutput: vi.fn(),
  closeOwner: vi.fn(),
}))

vi.mock('./probe/public.mjs', () => publicApi)
vi.mock('./probe/publication.mjs', () => ({
  async mutateAndAssertOutputs(owners: unknown[], relative: string, expected: string | null, mutate: () => Promise<void>) {
    await mutate()
    for (const owner of owners) {
      await publicApi.assertOutput(owner, relative, expected)
    }
  },
}))

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'chokidar-recovery-contract-'))
  await mkdir(path.join(root, 'src'))
  publicApi.openPublicOwner.mockReset().mockResolvedValue({ kind: 'artifact' })
  publicApi.assertOutput.mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function context(injectedError: Error, errors: Error[]) {
  return {
    scenario: { kind: 'recovery' },
    root,
    owners: [],
    errors,
    instrumentation: { injected: 1 },
    injectedError,
    recoveryFailure: createRecoveryFailureObserver(),
    evidence: {},
  }
}

const completed = { injectedOnce: true, factoryCompleted: true, createEmitted: true, changeEmitted: true, deleteEmitted: true }
const injected = () => Object.assign(new Error('Injected native directory registration EPERM'), { code: 'EPERM' })

it('零公开错误保留正恢复通过，create/change/delete 顺序不变', async () => {
  const ctx = context(injected(), [])
  await exerciseScenario(ctx)
  assert.deepEqual(ctx.evidence, completed)
  assert.deepEqual(publicApi.assertOutput.mock.calls.map(([, file, text]) => [file, text]), [
    ['reborn/marker.txt', 'recreated-directory'],
    ['reborn/marker.txt', 'changed-after-recovery'],
    ['reborn/marker.txt', null],
  ])
  assert.deepEqual(ctx.errors, [])
})

it('完整恢复后保留实际零错断言，精确单例原错误由同一异常对象绑定的现场记录证明', async () => {
  const original = injected()
  const ctx = context(original, [original])
  await assert.rejects(exerciseScenario(ctx), (error: unknown) => {
    assert(error instanceof Error && 'code' in error && error.code === 'ERR_ASSERTION')
    assert.notEqual(error, original)
    const failure = ctx.recoveryFailure.describe(error)
    assert.equal(failure.stage, 'recovery-final-public-errors')
    assert.equal(failure.publicErrors.length, 1)
    assert.equal(failure.publicErrors[0].originalInjectedError, true)
    assert.equal(failure.publicErrors[0].code, 'EPERM')
    assert.equal(ctx.recoveryFailure.describe(new Error(error.message)), undefined)
    return true
  })
  assert.equal(original.code, 'EPERM')
  assert.deepEqual(ctx.evidence, {})
  assert.deepEqual(ctx.errors, [original])
  assert.equal(publicApi.assertOutput.mock.calls.length, 3)
})

const invalidErrors: [string, (original: Error) => Error[]][] = [
  ['重复原对象', original => [original, original]],
  ['原对象混杂其他错误', original => [original, new Error('unrelated')]],
  ['同码同消息的不同对象', () => [injected()]],
]

it.each(invalidErrors)('%s 不得伪装成原始负控错误', async (_label, errors) => {
  const original = injected()
  const ctx = context(original, errors(original))
  const callbacks = [...ctx.errors]
  await assert.rejects(exerciseScenario(ctx), (error: unknown) =>
    error !== original && error instanceof Error && 'code' in error && error.code === 'ERR_ASSERTION')
  assert.deepEqual(ctx.errors, callbacks)
  assert.deepEqual(ctx.evidence, {})
})

it('先前输出失败不被已公开的原 EPERM 覆盖，也不补造完整恢复证据', async () => {
  const original = injected()
  const failure = new Error('output did not reach expected state')
  publicApi.assertOutput.mockRejectedValueOnce(failure)
  const ctx = context(original, [original])
  await assert.rejects(exerciseScenario(ctx), error => error === failure)
  assert.deepEqual(ctx.evidence, {})
  assert.deepEqual(ctx.errors, [original])
  assert.equal(publicApi.assertOutput.mock.calls.length, 1)
})
