import type { CompilerContext, MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin, onWatcherServiceDrained } from '../watcherPlugin'
import { claimSidecarDelivery, ownsSidecarDelivery } from './sidecarDelivery'

const context = () => ({ configService: {} }) as Pick<CompilerContext, 'configService'>

describe('classic sidecar delivery ownership', () => {
  it('leaves ordinary bundler, plugin and lib watch fallback available without an owner', () => {
    const ctx = context()
    expect(ownsSidecarDelivery(ctx, '/project/src/page.wxss', 'delete')).toBe(false)
  })

  it('uses the active scope and event instead of inferring ownership from a suffix', () => {
    const ctx = context()
    const matches = vi.fn((file: string, event: string) => file === '/project/src/page.wxss' && event !== 'update')
    const release = claimSidecarDelivery(ctx, matches)
    try {
      expect(ownsSidecarDelivery(ctx, '/project/src/page.wxss', 'create')).toBe(true)
      expect(ownsSidecarDelivery(ctx, '/project/src/page.wxss', 'delete')).toBe(true)
      expect(ownsSidecarDelivery(ctx, '/project/src/page.wxss', 'update')).toBe(false)
      expect(ownsSidecarDelivery(ctx, '/external/theme.wxss', 'delete')).toBe(false)
    }
    finally {
      release()
    }
  })

  it('keeps a replacement owner when the previous generation closes repeatedly', () => {
    const ctx = context()
    const previous = claimSidecarDelivery(ctx, file => file.endsWith('/previous.wxss'))
    const current = claimSidecarDelivery(ctx, file => file.endsWith('/current.wxss'))
    previous()
    previous()
    expect(ownsSidecarDelivery(ctx, '/project/src/current.wxss', 'delete')).toBe(true)
    expect(ownsSidecarDelivery(ctx, '/project/src/previous.wxss', 'delete')).toBe(false)
    current()
    current()
    expect(ownsSidecarDelivery(ctx, '/project/src/current.wxss', 'delete')).toBe(false)
  })

  it('isolates projects even when their config or physical source is shared', () => {
    const first = context()
    const second = { configService: first.configService }
    const release = claimSidecarDelivery(first, () => true)
    try {
      expect(ownsSidecarDelivery(first, '/shared/theme.css', 'delete')).toBe(true)
      expect(ownsSidecarDelivery(second, '/shared/theme.css', 'delete')).toBe(false)
    }
    finally {
      release()
    }
  })

  it('retains delivery ownership until the last legacy watcher has finished closing', async () => {
    const ctx = { runtimeState: createRuntimeState(), configService: {} } as MutableCompilerContext
    createWatcherServicePlugin(ctx)
    const service = ctx.watcherService!
    const finished = Promise.withResolvers<void>()
    const close = vi.fn(() => finished.promise)
    service.sidecarWatcherMap.set('/project/src', { close })
    const release = claimSidecarDelivery(ctx as CompilerContext, () => true, service)
    const closing = service.closeAll()
    expect(service.closeAll()).toBe(closing)
    expect(ownsSidecarDelivery(ctx as CompilerContext, '/project/src/page.wxss', 'delete')).toBe(true)
    finished.resolve()
    await closing
    expect(close).toHaveBeenCalledOnce()
    expect(ownsSidecarDelivery(ctx as CompilerContext, '/project/src/page.wxss', 'delete')).toBe(false)
    release()
    await service.closeAll()
    expect(close).toHaveBeenCalledOnce()
  })

  it('preserves resource and synchronous drain errors while running cleanup once', async () => {
    const ctx = { runtimeState: createRuntimeState() } as MutableCompilerContext
    createWatcherServicePlugin(ctx)
    const service = ctx.watcherService!
    const resourceFailure = new Error('legacy close failed')
    const ownerFailure = new Error('delivery owner cleanup failed')
    service.sidecarWatcherMap.set('/project/src', {
      close: vi.fn(async () => {
        throw resourceFailure
      }),
    })
    let reentrant: void | Promise<void>
    const cleanup = vi.fn(() => {
      reentrant = service.closeAll()
      throw ownerFailure
    })
    onWatcherServiceDrained(service, cleanup)
    const closing = service.closeAll()
    const failure = await Promise.resolve(closing).catch(error => error as unknown)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([resourceFailure, ownerFailure])
    expect(reentrant!).toBe(closing)
    expect(service.closeAll()).toBe(closing)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('unregisters a prior generation cleanup without disturbing a replacement', async () => {
    const ctx = { runtimeState: createRuntimeState(), configService: {} } as MutableCompilerContext
    createWatcherServicePlugin(ctx)
    const service = ctx.watcherService!
    const previous = vi.fn()
    const unregister = onWatcherServiceDrained(service, previous)
    unregister()
    unregister()
    const oldOwner = claimSidecarDelivery(ctx as CompilerContext, () => true, service)
    const newOwner = claimSidecarDelivery(ctx as CompilerContext, () => true, service)
    oldOwner()
    await service.closeAll()
    expect(previous).not.toHaveBeenCalled()
    expect(ownsSidecarDelivery(ctx as CompilerContext, '/project/src/page.wxss', 'delete')).toBe(false)
    newOwner()
  })
})
