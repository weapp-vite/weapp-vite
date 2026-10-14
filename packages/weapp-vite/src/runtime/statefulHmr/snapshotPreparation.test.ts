import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrSnapshotBatch } from './snapshotScheduler'
import { expect, it, vi } from 'vitest'
import { compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { createRuntimeState } from '../runtimeState'
import { withStatefulHmrSnapshotPreparation } from './snapshotPreparation'

function fixture(mode: StatefulHmrSnapshotBatch['mode'] = 'refresh') {
  const ctx = { runtimeState: createRuntimeState() } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const snapshot: StatefulHmrSnapshot = { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() }
  const rebuild = vi.fn(async (_files: string[], _sources?: ReadonlyMap<string, string | null>) => snapshot)
  const batch = { mode, files: ['app.wxss'], isSuperseded: vi.fn(() => false) }
  return { ctx, host, snapshot, rebuild, batch }
}

it.each(['full', 'disabled', 'unsupported'] as const)('keeps the ordinary rebuild contract for %s', async (reason) => {
  const app = fixture(reason === 'full' ? 'full' : 'refresh')
  if (reason !== 'disabled') {
    app.host.register('provider', reason === 'unsupported' ? undefined : async () => ({}))
  }
  const freeze = vi.spyOn(app.host, 'freeze')
  const prepare = vi.spyOn(app.host, 'prepare')
  const consumed = await withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, async ({ input, rebuild }) => {
    expect(input).toBeUndefined()
    return rebuild()
  })
  expect(consumed).toBe(app.snapshot)
  expect(app.rebuild).toHaveBeenCalledExactlyOnceWith(app.batch.files)
  expect(freeze).not.toHaveBeenCalled()
  expect(prepare).not.toHaveBeenCalled()
})

it('starts providers synchronously with one fixed source map and retains visual before values', async () => {
  const app = fixture()
  app.host.captureNative('page.vue', '<template><view>before</view></template>')
  app.host.setNativeSources(['page.vue'])
  app.host.captureNative('page.vue', '<template><view>after</view></template>')
  app.batch.files = ['page.vue']
  const pending = Promise.withResolvers<WeappCompilerHmrPreparation>()
  const dispose = vi.fn()
  const prepare = vi.fn((_input: WeappCompilerHmrRequest) => pending.promise)
  app.host.register('provider', prepare)
  const freeze = vi.spyOn(app.host, 'freeze')
  const consume = vi.fn(async ({ input, rebuild }: { input?: WeappCompilerHmrRequest, rebuild: () => Promise<StatefulHmrSnapshot> }) => {
    expect(input).toBe(prepare.mock.calls[0]![0])
    return rebuild()
  })
  const refreshing = withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, consume)

  expect(prepare).toHaveBeenCalledOnce()
  expect(freeze).toHaveBeenCalledExactlyOnceWith([])
  const input = prepare.mock.calls[0]![0]
  expect(Object.isFrozen(input)).toBe(true)
  expect(Object.isFrozen(input.changedFiles)).toBe(true)
  expect(input.sources).toBe(freeze.mock.results[0]!.value.sources)
  expect(input.changedFiles).toEqual(['page.vue'])
  expect(consume).not.toHaveBeenCalled()
  app.host.capture('page.vue', '<template><view>later</view></template>')
  pending.resolve({ dispose })
  await expect(refreshing).resolves.toBe(app.snapshot)
  expect(app.rebuild).toHaveBeenCalledExactlyOnceWith(['page.vue'], input.sources)
  expect(input.sources.get(compilerSourceId('page.vue'))).toContain('after')
  expect(app.host.hasVisualChanges(['page.vue'])).toBe(true)
  expect(dispose).toHaveBeenCalledOnce()
})

it('does not open a provider for a refresh already superseded at entry', async () => {
  const app = fixture()
  const prepare = vi.fn(async () => ({}))
  app.host.register('provider', prepare)
  app.batch.isSuperseded.mockReturnValue(true)
  const freeze = vi.spyOn(app.host, 'freeze')
  const consume = vi.fn()
  await expect(withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, consume)).resolves.toBeUndefined()
  expect(freeze).not.toHaveBeenCalled()
  expect(prepare).not.toHaveBeenCalled()
  expect(consume).not.toHaveBeenCalled()
})

it.each(['superseded', 'closed'] as const)('waits for and releases pending preparation after the batch is %s', async () => {
  const app = fixture()
  const pending = Promise.withResolvers<WeappCompilerHmrPreparation>()
  const disposal = Promise.withResolvers<void>()
  const dispose = vi.fn(() => disposal.promise)
  app.host.register('provider', () => pending.promise)
  const consume = vi.fn()
  const refreshing = withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, consume)
  app.batch.isSuperseded.mockReturnValue(true)
  let settled = false
  void refreshing.then(() => {
    settled = true
  })
  pending.resolve({ dispose })
  await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce())
  expect(consume).not.toHaveBeenCalled()
  expect(settled).toBe(false)
  disposal.resolve()
  await refreshing
  expect(settled).toBe(true)
})

it.each(['consume', 'rebuild'] as const)('retains the %s failure while releasing every successful preparation', async (stage) => {
  const app = fixture()
  const first = vi.fn()
  const second = vi.fn()
  app.host.register('first', async () => ({ dispose: first }))
  app.host.register('second', async () => ({ dispose: second }))
  const failure = new Error('refresh failed')
  if (stage === 'rebuild') {
    app.rebuild.mockRejectedValueOnce(failure)
  }
  await expect(withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, async ({ rebuild }) => {
    if (stage === 'consume') {
      throw failure
    }
    return rebuild()
  })).rejects.toBe(failure)
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
})

it.each(['primary', 'cleanup-only'] as const)('attempts synchronous and asynchronous cleanup and preserves %s errors', async (kind) => {
  const app = fixture()
  const primary = new Error('output write failed')
  const syncFailure = new Error('sync cleanup failed')
  const asyncFailure = new Error('async cleanup failed')
  const first = vi.fn(() => {
    throw syncFailure
  })
  const second = vi.fn(async () => {
    throw asyncFailure
  })
  const last = vi.fn()
  app.host.register('first', async () => ({ dispose: first }))
  app.host.register('second', async () => ({ dispose: second }))
  app.host.register('last', async () => ({ dispose: last }))
  const error = await withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, async () => {
    if (kind === 'primary') {
      throw primary
    }
  }).catch(error => error)
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
  expect(last).toHaveBeenCalledOnce()
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual(kind === 'primary' ? [primary, syncFailure, asyncFailure] : [syncFailure, asyncFailure])
  expect(error.cause).toBe(kind === 'primary' ? primary : undefined)
})

it('retains a lone cleanup rejection unchanged', async () => {
  const app = fixture()
  const failure = new Error('cleanup failed')
  app.host.register('provider', async () => ({ dispose: () => {
    throw failure
  } }))
  await expect(withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, async () => {})).rejects.toBe(failure)
})

it('lets the host release partial preparations once when another provider rejects', async () => {
  const app = fixture()
  const failure = new Error('provider failed')
  const dispose = vi.fn()
  const consume = vi.fn()
  app.host.register('first', async () => ({ dispose }))
  app.host.register('broken', async () => {
    throw failure
  })
  await expect(withStatefulHmrSnapshotPreparation(app.ctx, app.batch, app.rebuild, consume)).rejects.toBe(failure)
  expect(dispose).toHaveBeenCalledOnce()
  expect(consume).not.toHaveBeenCalled()
  expect(app.rebuild).not.toHaveBeenCalled()
})
