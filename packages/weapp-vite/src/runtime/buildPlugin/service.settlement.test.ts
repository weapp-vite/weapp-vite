import type { RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { DevModuleGraphChange } from '../../moduleGraph/devProvider'
import { EventEmitter } from 'node:events'
import { WEAPP_VITE_CLASSIC_SETTLEMENT_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createContext, mocks } from './serviceRestart/fixture'

const { createBuildService } = await import('./service')

beforeEach(() => {
  vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
  mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
  mocks.build.mockReset().mockResolvedValue({ output: [] })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  mocks.restarts.length = 0
})

async function createFixture() {
  const ctx = createContext()
  const file = '/project/src/pages/home/index.ts'
  ctx.runtimeState.build.hmr.resolvedEntryMap.set(file, { id: file })
  vi.spyOn(ctx.moduleGraphService, 'hasModule').mockImplementation(id => id === file)
  vi.spyOn(ctx.moduleGraphService, 'collectAffectedEntries').mockImplementation(() => new Set([file]))
  let onChange: (change: DevModuleGraphChange) => void = () => {
    throw new Error('Provider not connected')
  }
  mocks.watch.mockImplementation(() => {
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
      close: vi.fn(async () => { watcher.removeAllListeners() }),
    })
    setImmediate(() => watcher.emit('ready'))
    return watcher
  })
  mocks.provider.mockImplementation(async (_ctx: unknown, _options: unknown, change: (change: DevModuleGraphChange) => void) => {
    onChange = change
    return { close: vi.fn(async () => {}) }
  })
  const watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
  const settlement = Reflect.get(ctx, Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)) as { whenSettled: () => Promise<void> }
  return {
    ctx,
    settlement,
    save: () => onChange({ event: 'update', file }),
    close: async () => {
      await watcher.close()
      await ctx.watcherService.closeAll()
    },
  }
}

it('flushes an accepted classic save and waits for its actual publication', async () => {
  const fixture = await createFixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  mocks.build.mockImplementationOnce(async () => {
    entered.resolve()
    await release.promise
    return { output: [] }
  })
  const sampled = vi.fn()
  let waiting: Promise<void> | undefined
  try {
    fixture.save()
    waiting = fixture.settlement.whenSettled().then(sampled)
    await entered.promise
    expect(sampled).not.toHaveBeenCalled()
    release.resolve()
    await waiting
    expect(sampled).toHaveBeenCalledOnce()
    expect(mocks.build).toHaveBeenCalledTimes(2)
    expect(mocks.forbiddenIo).not.toHaveBeenCalled()
  }
  finally {
    release.resolve()
    await waiting
    await fixture.close()
  }
})

it('reports the original failed publication and recovers only after a later successful build', async () => {
  const fixture = await createFixture()
  const failure = new Error('classic native build failed')
  mocks.build.mockRejectedValueOnce(failure)
  try {
    fixture.save()
    await expect(fixture.settlement.whenSettled()).rejects.toBe(failure)
    await expect(fixture.settlement.whenSettled()).rejects.toBe(failure)
    vi.mocked(fixture.ctx.moduleGraphService.collectAffectedEntries).mockReturnValue(new Set())
    fixture.save()
    // 没有实际生成的批次不能撤销上一发布的失败。
    await expect(fixture.settlement.whenSettled()).rejects.toBe(failure)
    expect(mocks.build).toHaveBeenCalledTimes(2)
    vi.mocked(fixture.ctx.moduleGraphService.collectAffectedEntries).mockReturnValue(new Set(['/project/src/pages/home/index.ts']))
    fixture.save()
    await expect(fixture.settlement.whenSettled()).resolves.toBeUndefined()
    expect(mocks.build).toHaveBeenCalledTimes(3)
    expect(mocks.logger.error).toHaveBeenCalledWith(failure)
  }
  finally {
    await fixture.close()
  }
})

it('retires a closed classic generation instead of reporting a stale successful sample', async () => {
  const fixture = await createFixture()
  await fixture.settlement.whenSettled()
  await fixture.close()
  expect(Reflect.get(fixture.ctx, Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY))).toBeUndefined()
  await expect(fixture.settlement.whenSettled()).rejects.toThrow('retired')
})

it('retains a late failure when a later no-op batch was already queued', async () => {
  const fixture = await createFixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const failure = new Error('late native build failure')
  mocks.build.mockImplementationOnce(async () => {
    entered.resolve()
    await release.promise
    throw failure
  })
  let pending: Promise<unknown>[] = []
  try {
    fixture.save()
    const first = expect(fixture.settlement.whenSettled()).rejects.toBe(failure)
    await entered.promise
    vi.mocked(fixture.ctx.moduleGraphService.collectAffectedEntries).mockReturnValue(new Set())
    fixture.save()
    const next = expect(fixture.settlement.whenSettled()).rejects.toBe(failure)
    pending = [first, next]
    release.resolve()
    await Promise.all(pending)
    expect(mocks.build).toHaveBeenCalledTimes(2)
  }
  finally {
    release.resolve()
    await Promise.allSettled(pending)
    await fixture.close()
  }
})
