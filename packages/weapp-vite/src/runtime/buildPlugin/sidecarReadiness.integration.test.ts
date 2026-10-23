import type { ReadinessHarness, ReadinessWatcher } from '../../../test/sidecarReadiness/fixture'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanupReadinessFixtures, leafErrors, startInitialBuild, withHeldReadiness } from '../../../test/sidecarReadiness/fixture'
import { createSnapshotTemplateFixture } from '../../../test/snapshotTemplates/fixture'

const harness = vi.hoisted(() => ({
  build: vi.fn(),
  change: undefined as ((change: { event: 'update' | 'create', file: string }) => void) | undefined,
  sidecars: [] as ReadinessWatcher[],
  readinessHold: undefined as ReadinessHarness['readinessHold'],
}))

vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), build: harness.build }))
vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: vi.fn(async (_ctx, _config, onChange) => {
    harness.change = onChange
    return { close: vi.fn(async () => {}) }
  }),
}))
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn((_roots, options?: { ignoreInitial?: boolean }) => {
      const asset = options?.ignoreInitial === false
      const watcher = Object.assign(new EventEmitter(), {
        asset,
        closed: false,
        add: vi.fn(),
        unwatch: vi.fn(),
        close: vi.fn(async () => {
          watcher.closed = true
          // Chokidar 关闭时移除全部监听器，不会补发 ready 或 close 事件。
          watcher.removeAllListeners()
        }),
      })
      harness.sidecars.push(watcher)
      setImmediate(() => {
        if (watcher.closed) {
          return
        }
        const hold = harness.readinessHold
        if (hold?.asset === asset) {
          hold.observe(watcher)
        }
        else {
          watcher.emit('ready')
        }
      })
      return watcher
    }),
  },
}))

const cleanups: Array<() => Promise<void>> = []
const expectedCleanupErrors = new Set<unknown>()

beforeEach(() => {
  harness.build.mockReset()
  harness.change = undefined
  harness.sidecars = []
  harness.readinessHold = undefined
  expectedCleanupErrors.clear()
})

afterEach(async () => cleanupReadinessFixtures(cleanups, expectedCleanupErrors))

it('retains the original readiness error and cleanup failure during initial startup', async () => withHeldReadiness(harness, 'sidecar', async (readiness) => {
  const fixture = await startInitialBuild(harness, cleanups, readiness)
  const { sidecar } = fixture
  const scanFailure = new Error('initial registration failed')
  const closeFailure = new Error('initial cleanup failed')
  sidecar.close.mockImplementationOnce(async () => {
    sidecar.closed = true
    sidecar.removeAllListeners()
    throw closeFailure
  })
  sidecar.emit('error', scanFailure)
  const result = await fixture.outcome
  expect(result).toHaveProperty('error')
  const failure = 'error' in result ? result.error : undefined
  expectedCleanupErrors.add(scanFailure)
  expectedCleanupErrors.add(closeFailure)
  // 对象身份必须保留，不能只保留遮蔽首错后的关闭文案。
  expect(leafErrors(failure)).toContain(scanFailure)
  expect(leafErrors(failure)).toContain(closeFailure)
  expect(failure).toHaveProperty('cause', scanFailure)
  for (const watcher of harness.sidecars) {
    expect(watcher.closed).toBe(true)
    expect(watcher.listenerCount('ready')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
  }
}))

it('does not register or subscribe a generation drained before initial readiness', async () => withHeldReadiness(harness, 'sidecar', async (readiness) => {
  const fixture = await startInitialBuild(harness, cleanups, readiness)
  const register = vi.spyOn(fixture.ctx.watcherService, 'setRollupWatcher')
  const closing = fixture.ctx.watcherService.closeAll()
  expect(fixture.ctx.watcherService.closeAll()).toBe(closing)
  await closing
  const result = await fixture.outcome
  expect(result).toHaveProperty('watcher')
  if (!('watcher' in result) || !result.watcher || !('close' in result.watcher)) {
    throw new Error('Expected a closed classic watcher')
  }
  const onEvent = vi.fn()
  result.watcher.on('event', onEvent)
  expect(onEvent).not.toHaveBeenCalled()
  expect(register).not.toHaveBeenCalled()
  await result.watcher.close()
  await fixture.ctx.watcherService.closeAll()
  expect(fixture.ctx.watcherService.sidecarWatcherMap.size).toBe(0)
  expect(fixture.ctx.watcherService.rollupWatcherMap.size).toBe(0)
  for (const watcher of harness.sidecars) {
    expect(watcher.closed).toBe(true)
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(watcher.listenerCount('ready')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
  }
}))

it('delivers replacement readiness and cleanup errors through the original close handle', async () => {
  const fixture = await createSnapshotTemplateFixture(harness, cleanups)
  const original = fixture.ctx.watcherService.getRollupWatcher()!
  const initialBuilds = harness.build.mock.calls.length
  await withHeldReadiness(harness, 'sidecar', async (readiness) => {
    fixture.ctx.buildService.requestConfigRestart()
    // 相同字节的迟到通知会被首构去重；真实保存才能完成旧代发布并消费显式重启请求。
    await fixture.save('shared/card.wxml', '<template name="card"><view>restart before readiness failure</view></template>')
    fixture.update('shared/card.wxml')
    const replacement = await readiness
    expect(await fixture.readOutput('shared/card.wxml')).toContain('restart before readiness failure')
    expect(harness.build).toHaveBeenCalledTimes(initialBuilds + 1)
    const scanFailure = new Error('replacement registration failed')
    const closeFailure = new Error('replacement cleanup failed')
    replacement.close.mockImplementationOnce(async () => {
      replacement.closed = true
      replacement.removeAllListeners()
      throw closeFailure
    })
    replacement.emit('error', scanFailure)
    const closing = original.close()
    expect(original.close()).toBe(closing)
    const failure = await closing.then(() => undefined, error => error as unknown)
    expectedCleanupErrors.add(scanFailure)
    expectedCleanupErrors.add(closeFailure)
    expect(leafErrors(failure)).toContain(scanFailure)
    expect(leafErrors(failure)).toContain(closeFailure)
    await expect(original.close()).rejects.toBe(failure)
    for (const watcher of harness.sidecars) {
      expect(watcher.closed).toBe(true)
      expect(watcher.listenerCount('ready')).toBe(0)
      expect(watcher.listenerCount('error')).toBe(0)
    }
  })
})

it('closes a classic config restart before its replacement sidecar is ready through the original handle', async () => {
  const fixture = await createSnapshotTemplateFixture(harness, cleanups)
  const original = fixture.ctx.watcherService.getRollupWatcher()!
  const initialBuilds = harness.build.mock.calls.length
  await withHeldReadiness(harness, 'sidecar', async (readiness) => {
    fixture.ctx.buildService.requestConfigRestart()
    await fixture.save('shared/card.wxml', '<template name="card"><view>restart publication</view></template>')
    fixture.update('shared/card.wxml')
    const replacement = await readiness
    expect(replacement.asset).toBe(false)
    expect(replacement.listenerCount('ready')).toBeGreaterThan(0)
    // 触发重启的旧代已发布；第二代仍待扫描，不能在就绪前启动自己的首次构建。
    expect(await fixture.readOutput('shared/card.wxml')).toContain('restart publication')
    expect(harness.build).toHaveBeenCalledTimes(initialBuilds + 1)
    const closing = original.close()
    expect(original.close()).toBe(closing)
    await expect(closing).resolves.toBeUndefined()
    expect(fixture.ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(fixture.ctx.watcherService.rollupWatcherMap.size).toBe(0)
    for (const watcher of harness.sidecars) {
      expect(watcher.closed).toBe(true)
      expect(watcher.close).toHaveBeenCalledOnce()
      expect(watcher.listenerCount('ready')).toBe(0)
      expect(watcher.listenerCount('error')).toBe(0)
    }
  })
})

it('closes a classic config restart before its replacement asset scan is ready through the original handle', async () => {
  const fixture = await createSnapshotTemplateFixture(harness, cleanups)
  const original = fixture.ctx.watcherService.getRollupWatcher()!
  const register = vi.spyOn(fixture.ctx.watcherService, 'setRollupWatcher')
  const initialBuilds = harness.build.mock.calls.length
  let settled: Promise<unknown> | undefined
  try {
    await withHeldReadiness(harness, 'asset', async (readiness) => {
      fixture.ctx.buildService.requestConfigRestart()
      await fixture.save('shared/card.wxml', '<template name="card"><view>restart before asset scan</view></template>')
      fixture.update('shared/card.wxml')
      const replacementAsset = await readiness
      // 新代首构已写出，但资产初始扫描尚未就绪，不能提前登记可继续运行的 controller。
      expect(await fixture.readOutput('shared/card.wxml')).toContain('restart before asset scan')
      expect(harness.build).toHaveBeenCalledTimes(initialBuilds + 2)
      expect(register).not.toHaveBeenCalled()
      expect(replacementAsset.closed).toBe(false)
      const closing = original.close()
      settled = Promise.resolve(closing).then(() => undefined, (error: unknown) => error)
      expect(original.close()).toBe(closing)
      // 不补发 ready：原 handle 必须主动释放仍在等待扫描的资产 owner。
      await vi.waitFor(() => expect(replacementAsset.closed).toBe(true))
      await expect(closing).resolves.toBeUndefined()
      const onEvent = vi.fn()
      original.on('event', onEvent)
      expect(onEvent).not.toHaveBeenCalled()
      expect(register).not.toHaveBeenCalled()
      expect(harness.build).toHaveBeenCalledTimes(initialBuilds + 2)
      expect(fixture.ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(fixture.ctx.watcherService.rollupWatcherMap.size).toBe(0)
      await original.close()
      await fixture.ctx.watcherService.closeAll()
      for (const watcher of harness.sidecars) {
        expect(watcher.closed).toBe(true)
        expect(watcher.close).toHaveBeenCalledOnce()
        expect(watcher.eventNames()).toEqual([])
      }
    })
  }
  finally {
    // 先由生命周期闸门解除本例扫描，再接住尚未完成的关闭。
    await settled
  }
})

it('drains a replacement native build closed before its asset owner is registered', async () => {
  const fixture = await createSnapshotTemplateFixture(harness, cleanups)
  const original = fixture.ctx.watcherService.getRollupWatcher()!
  const register = vi.spyOn(fixture.ctx.watcherService, 'setRollupWatcher')
  const initialBuilds = harness.build.mock.calls.length
  const initialSidecars = harness.sidecars.length
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let settled: Promise<unknown> | undefined
  try {
    await withHeldReadiness(harness, 'asset', async () => {
      try {
        fixture.controls.beforeRender = async () => {
          // 第一轮是旧代保存；第二轮才是替换代尚未写盘的首构。
          if (harness.build.mock.calls.length === initialBuilds + 2) {
            entered.resolve()
            await release.promise
          }
        }
        fixture.ctx.buildService.requestConfigRestart()
        await fixture.save('shared/card.wxml', '<template name="card"><view>close during replacement build</view></template>')
        fixture.update('shared/card.wxml')
        await entered.promise
        expect(harness.sidecars.slice(initialSidecars).some(watcher => watcher.asset)).toBe(false)
        expect(register).not.toHaveBeenCalled()
        const publication = harness.build.mock.results[initialBuilds + 1]!
        expect(publication.type).toBe('return')
        if (publication.type !== 'return') {
          throw new Error('Expected the pending replacement native build')
        }
        let outcome: PromiseSettledResult<void> | undefined
        const closing = original.close()
        settled = Promise.resolve(closing).then(
          value => outcome = { status: 'fulfilled', value },
          reason => outcome = { status: 'rejected', reason },
        )
        expect(original.close()).toBe(closing)
        await Promise.resolve()
        expect(outcome).toBeUndefined()
        release.resolve()
        // 先等真实 native 发布完成；仅对后续关闭协议做有界断言，不把构建耗时塞入 1 秒轮询。
        await publication.value
        await vi.waitFor(() => expect(outcome).toEqual({ status: 'fulfilled', value: undefined }))
        await expect(closing).resolves.toBeUndefined()
        expect(register).not.toHaveBeenCalled()
        expect(fixture.ctx.watcherService.rollupWatcherMap.size).toBe(0)
        expect(fixture.ctx.watcherService.sidecarWatcherMap.size).toBe(0)
        for (const watcher of harness.sidecars) {
          expect(watcher.closed).toBe(true)
          expect(watcher.close).toHaveBeenCalledOnce()
          expect(watcher.eventNames()).toEqual([])
        }
      }
      finally {
        fixture.controls.beforeRender = undefined
        release.resolve()
      }
    })
  }
  finally {
    await settled
  }
})
