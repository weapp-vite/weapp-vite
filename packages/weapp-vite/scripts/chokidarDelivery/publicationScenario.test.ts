import assert from 'node:assert/strict'
import path from 'node:path'
import { beforeEach, it, vi } from 'vitest'
import { createPublicationObserver } from './probe/publication.mjs'
import { createRecoveryFailureObserver } from './probe/recoveryFailure.mjs'
import { exerciseScenario } from './probe/scenarios.mjs'

const harness = vi.hoisted(() => ({
  owner: undefined as Record<string, unknown> | undefined,
  output: 'before-registration' as string | null,
  mutations: [] as string[],
  observed: [] as (string | null)[],
  onMutation: undefined as ((event: string) => void) | undefined,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async (_file: string, text: string) => {
    harness.mutations.push(text)
    harness.onMutation?.(text)
  }),
  rm: vi.fn(async () => {
    harness.mutations.push('delete')
    harness.onMutation?.('delete')
  }),
  readFile: vi.fn(async () => {
    harness.observed.push(harness.output)
    if (harness.output === null) {
      throw Object.assign(new Error('output is absent'), { code: 'ENOENT' })
    }
    return harness.output
  }),
}))

vi.mock('./probe/public.mjs', () => ({
  openPublicOwner: vi.fn(async () => harness.owner),
  assertOutput: vi.fn(async () => {
    assert.fail('Recovery mutations must observe complete publication before the next mutation')
  }),
  closeOwner: vi.fn(),
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolve_) => {
    resolve = resolve_
  })
  return { promise, resolve }
}

async function nextMutation(mutation: Promise<void>, operation: Promise<unknown>) {
  await Promise.race([mutation, operation.then(() => {
    assert.fail('The recovery scenario completed before the next expected mutation')
  })])
}

beforeEach(() => {
  harness.owner = undefined
  harness.output = 'before-registration'
  harness.mutations.length = 0
  harness.observed.length = 0
  harness.onMutation = undefined
})

it('实际 recovery 场景的 create、change、delete 各等待自身自然发布，保留完整输出与零错误终验', async () => {
  const outDir = path.resolve('scenario-output')
  const publications = createPublicationObserver(outDir)
  harness.owner = { kind: 'artifact', outDir, publications }
  const created = deferred()
  const changed = deferred()
  const deleted = deferred()
  harness.onMutation = (event) => {
    if (event === 'recreated-directory') {
      created.resolve()
    }
    else if (event === 'changed-after-recovery') {
      changed.resolve()
    }
    else if (event === 'delete') {
      deleted.resolve()
    }
  }
  const ctx = {
    scenario: { kind: 'recovery' },
    root: '.',
    owners: [],
    errors: [],
    instrumentation: { injected: 1 },
    injectedError: new Error('unused injected error'),
    recoveryFailure: createRecoveryFailureObserver(),
    evidence: {},
  }
  const operation = exerciseScenario(ctx)
  let completed = false
  operation.then(() => {
    completed = true
  }, () => {})

  await nextMutation(created.promise, operation)
  harness.output = 'recreated-directory'
  assert.deepEqual(harness.mutations, ['recreated-directory'])
  assert.deepEqual(harness.observed, [])
  await publications.onRebuilt({ miniprogramRootPath: outDir })

  await nextMutation(changed.promise, operation)
  harness.output = 'changed-after-recovery'
  assert.deepEqual(harness.mutations, ['recreated-directory', 'changed-after-recovery'])
  assert.deepEqual(harness.observed, ['recreated-directory'])
  await publications.onRebuilt({ miniprogramRootPath: outDir })

  await nextMutation(deleted.promise, operation)
  harness.output = null
  assert.deepEqual(harness.observed, ['recreated-directory', 'changed-after-recovery'])
  assert.equal(completed, false)
  assert.deepEqual(ctx.evidence, {})
  await publications.onRebuilt({ miniprogramRootPath: outDir })
  await operation
  assert.deepEqual(harness.mutations, ['recreated-directory', 'changed-after-recovery', 'delete'])
  assert.deepEqual(harness.observed, ['recreated-directory', 'changed-after-recovery', null])
  assert.deepEqual(ctx.errors, [])
  assert.deepEqual(ctx.evidence, { injectedOnce: true, factoryCompleted: true, createEmitted: true, changeEmitted: true, deleteEmitted: true })
})
