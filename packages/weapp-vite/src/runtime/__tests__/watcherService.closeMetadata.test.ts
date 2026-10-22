import type { MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'
import { collectIndependentWatchFiles } from '../buildPlugin/independentWatch'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin, retainWatcherService } from '../watcherPlugin'

function createService() {
  const context = { runtimeState: createRuntimeState() } as MutableCompilerContext
  createWatcherServicePlugin(context)
  return { context, service: context.watcherService! }
}

function capture(collector: ReturnType<typeof collectIndependentWatchFiles>, files: string[]) {
  const hook = collector.plugin.buildEnd as (this: { getModuleIds: () => string[] }) => void
  hook.call({ getModuleIds: () => files })
}

describe('watcher service metadata generations', () => {
  it.each(['files', 'listeners', 'both'] as const)('releases new %s after an earlier controller drain with no watcher handles', async (metadata) => {
    const { context, service } = createService()
    const other = createService()
    const independent = context.runtimeState.build.independent
    const otherIndependent = other.context.runtimeState.build.independent
    const otherListener = vi.fn()
    otherIndependent.watchFiles.set('other', new Set(['other.vue']))
    otherIndependent.watchListeners.add(otherListener)

    const initialRelease = retainWatcherService(service)
    await initialRelease()
    const nextRelease = retainWatcherService(service)
    const notify = vi.fn()
    const collector = collectIndependentWatchFiles(independent.watchFiles, 'pkg', undefined, independent.watchListeners)
    if (metadata !== 'files') {
      independent.watchListeners.add(notify)
    }
    if (metadata !== 'listeners') {
      capture(collector, ['page.vue'])
      collector.commit()
    }
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)

    await nextRelease()
    expect(independent.watchFiles.size).toBe(0)
    expect(independent.watchListeners.size).toBe(0)
    notify.mockClear()
    // 关闭代次使在途子构建失效，不能在最终释放后重新登记依赖。
    capture(collector, ['late.vue'])
    collector.commit()
    await nextRelease()
    await service.closeAll()
    expect(independent.watchFiles.size).toBe(0)
    expect(notify).not.toHaveBeenCalled()
    expect(otherIndependent.watchFiles.get('other')).toEqual(new Set(['other.vue']))
    expect(otherIndependent.watchListeners.has(otherListener)).toBe(true)
    await other.service.closeAll()
  })

  it('clears the next metadata generation while preserving the previous drain failure', async () => {
    const { context, service } = createService()
    const independent = context.runtimeState.build.independent
    const failure = new Error('watcher close failed')
    const close = vi.fn(async () => {
      throw failure
    })
    service.setRollupWatcher({ close })
    await expect(service.closeAll()).rejects.toBe(failure)

    const collector = collectIndependentWatchFiles(independent.watchFiles, 'pkg')
    capture(collector, ['new.vue'])
    collector.commit()
    independent.watchListeners.add(vi.fn())
    await expect(service.closeAll()).rejects.toBe(failure)
    expect(independent.watchFiles.size).toBe(0)
    expect(independent.watchListeners.size).toBe(0)
    capture(collector, ['late.vue'])
    collector.commit()
    await expect(service.closeAll()).rejects.toBe(failure)
    expect(independent.watchFiles.size).toBe(0)
    expect(close).toHaveBeenCalledOnce()
  })
})
