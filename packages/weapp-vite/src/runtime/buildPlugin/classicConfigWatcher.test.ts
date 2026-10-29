import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClassicConfigWatcher } from './classicConfigWatcher'

const mocks = vi.hoisted(() => ({ watch: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))

function createWatcher(ready = true) {
  const watcher = Object.assign(new EventEmitter(), {
    add: vi.fn(),
    unwatch: vi.fn(async () => {}),
    close: vi.fn(async () => { watcher.removeAllListeners() }),
  })
  mocks.watch.mockReturnValueOnce(watcher)
  if (ready) {
    setImmediate(() => watcher.emit('ready'))
  }
  return watcher
}

afterEach(() => vi.clearAllMocks())

describe('classic session config watcher', () => {
  it('keeps notifications across generations and replaces dependency ownership', async () => {
    const config = { inlineConfig: {}, configFileDependencies: ['/project/vite.config.ts'] }
    const watcher = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    try {
      await owner.updateDependencies()
      const first = vi.fn()
      const releaseFirst = owner.subscribe(first)
      watcher.emit('change', config.configFileDependencies[0])
      expect(first).toHaveBeenCalledOnce()
      releaseFirst()
      // 停旧代、load 和启动新代期间没有通知丢失，也没有旧代回调继续交付。
      watcher.emit('change', config.configFileDependencies[0])
      const second = vi.fn()
      const releaseSecond = owner.subscribe(second)
      expect(second).toHaveBeenCalledOnce()
      releaseFirst()
      watcher.emit('change', config.configFileDependencies[0])
      expect(second).toHaveBeenCalledTimes(2)
      config.configFileDependencies = ['/project/config/mini.ts']
      const replacement = createWatcher()
      await owner.reload(async () => {}, () => false)
      expect(owner.hasPendingChanges).toBe(false)
      expect(watcher.add).not.toHaveBeenCalled()
      expect(mocks.watch).toHaveBeenLastCalledWith(['/project/config/mini.ts'], expect.any(Object))
      expect(watcher.close).toHaveBeenCalledOnce()
      watcher.emit('change', '/project/vite.config.ts')
      expect(second).toHaveBeenCalledTimes(2)
      replacement.emit('change', '/project/config/mini.ts')
      expect(second).toHaveBeenCalledTimes(3)
      expect(mocks.watch).toHaveBeenCalledTimes(2)
      releaseSecond()
    }
    finally {
      await owner.close()
    }
    expect(watcher.close).toHaveBeenCalledOnce()
  })

  it('reloads the newest configuration before releasing a generation when another save arrives during load', async () => {
    const config = { inlineConfig: {}, configFileDependencies: ['/project/vite.config.ts'] }
    const watcher = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let source = 'CONFIG-A'
    let effective: string | undefined
    const load = vi.fn(async () => {
      effective = source
      if (load.mock.calls.length === 1) {
        entered.resolve()
        await release.promise
      }
    })
    try {
      await owner.updateDependencies()
      watcher.emit('change', config.configFileDependencies[0])
      const reloading = owner.reload(load, () => false)
      await entered.promise
      source = 'CONFIG-B'
      watcher.emit('change', config.configFileDependencies[0])
      release.resolve()
      await reloading
      expect(load).toHaveBeenCalledTimes(2)
      expect(effective).toBe('CONFIG-B')
      expect(owner.hasPendingChanges).toBe(false)
      watcher.emit('change', config.configFileDependencies[0])
      expect(owner.hasPendingChanges).toBe(true)
    }
    finally {
      release.resolve()
      await owner.close()
    }
  })

  it('isolates other projects and joins idempotent close during configuration load', async () => {
    const config = { inlineConfig: {}, configFileDependencies: ['/project/vite.config.ts'] }
    const watcher = createWatcher()
    const otherWatcher = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    const other = createClassicConfigWatcher(config, vi.fn())
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const load = vi.fn(async () => {
      entered.resolve()
      await release.promise
    })
    try {
      await Promise.all([owner.updateDependencies(), other.updateDependencies()])
      const otherRequest = vi.fn()
      other.subscribe(otherRequest)
      const reloading = owner.reload(load, () => false)
      await entered.promise
      const closing = owner.close()
      expect(owner.close()).toBe(closing)
      watcher.emit('change', config.configFileDependencies[0])
      release.resolve()
      await Promise.all([closing, reloading])
      expect(load).toHaveBeenCalledOnce()
      expect(otherWatcher.close).not.toHaveBeenCalled()
      expect(otherRequest).not.toHaveBeenCalled()
      otherWatcher.emit('change', config.configFileDependencies[0])
      expect(otherRequest).toHaveBeenCalledOnce()
    }
    finally {
      release.resolve()
      await Promise.all([owner.close(), other.close()])
    }
  })

  it('retains ready and cleanup failures without leaking startup listeners', async () => {
    const config = { inlineConfig: {}, configFileDependencies: ['/project/vite.config.ts'] }
    const watcher = createWatcher(false)
    const onError = vi.fn()
    const owner = createClassicConfigWatcher(config, onError)
    const startupError = new Error('configuration watcher startup failed')
    const cleanupError = new Error('configuration watcher cleanup failed')
    watcher.close.mockRejectedValue(cleanupError)
    const starting = owner.updateDependencies()
    const rejected = expect(starting).rejects.toBe(startupError)
    await Promise.resolve()
    watcher.emit('error', startupError)
    await rejected
    expect(onError).not.toHaveBeenCalled()
    const closing = owner.close()
    expect(owner.close()).toBe(closing)
    const failure = await closing.catch(error => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure.errors).toHaveLength(2)
    expect(failure.errors[0]).toBe(startupError)
    expect(failure.errors[1]).toBe(cleanupError)
    expect(failure.cause).toBe(startupError)
    expect(owner.close()).toBe(closing)
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(watcher.listenerCount('ready')).toBe(0)
  })

  it('retains a runtime watcher failure together with shutdown failure', async () => {
    const config = { inlineConfig: {}, configFileDependencies: ['/project/vite.config.ts'] }
    const watcher = createWatcher()
    const onError = vi.fn()
    const owner = createClassicConfigWatcher(config, onError)
    const runtimeError = new Error('configuration watcher failed')
    const cleanupError = new Error('configuration watcher cleanup failed')
    await owner.updateDependencies()
    watcher.close.mockRejectedValue(cleanupError)
    watcher.emit('error', runtimeError)
    expect(onError).toHaveBeenCalledWith(runtimeError)
    await expect(owner.close()).rejects.toMatchObject({ errors: [runtimeError, cleanupError] })
  })

  it('waits for newly imported dependency readiness before reloading saves made during handoff', async () => {
    const entry = '/project/vite.config.ts'
    const imported = '/project/config/mini.ts'
    const config = { inlineConfig: {}, configFileDependencies: [entry] }
    const first = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    let source = 'CONFIG-A'
    let effective: string | undefined
    const load = vi.fn(async () => {
      effective = source
    })
    try {
      await owner.updateDependencies()
      const request = vi.fn()
      owner.subscribe(request)
      config.configFileDependencies = [entry, imported]
      const added = createWatcher(false)
      const reloading = owner.reload(load, () => false)
      await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(2))
      expect(load).toHaveBeenCalledOnce()
      expect(first.close).not.toHaveBeenCalled()
      // 新文件监听尚未安装，保存不会产生事件；必须在 ready 之后重新读取它。
      source = 'CONFIG-B'
      first.emit('change', entry)
      expect(request).toHaveBeenCalledOnce()
      added.emit('ready')
      await reloading
      expect(load).toHaveBeenCalledTimes(2)
      expect(effective).toBe('CONFIG-B')
      expect(owner.hasPendingChanges).toBe(false)
      first.emit('change', imported)
      added.emit('change', entry)
      expect(request).toHaveBeenCalledOnce()
      added.emit('change', imported)
      expect(request).toHaveBeenCalledTimes(2)
      expect(first.add).not.toHaveBeenCalled()
      expect(added.add).not.toHaveBeenCalled()
    }
    finally {
      await owner.close()
    }
    expect(first.close).toHaveBeenCalledOnce()
  })

  it('unwatches only removed dependencies while retaining the group that owns remaining files', async () => {
    const retained = '/project/vite.config.ts'
    const removed = '/project/config/old.ts'
    const added = '/project/config/new.ts'
    const config = { inlineConfig: {}, configFileDependencies: [retained, removed] }
    const first = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    try {
      await owner.updateDependencies()
      config.configFileDependencies = [retained, added]
      const second = createWatcher()
      await owner.reload(async () => {}, () => false)
      expect(first.unwatch).toHaveBeenCalledExactlyOnceWith([removed])
      expect(first.close).not.toHaveBeenCalled()
      const request = vi.fn()
      owner.subscribe(request)
      first.emit('change', removed)
      second.emit('change', retained)
      expect(request).not.toHaveBeenCalled()
      first.emit('change', retained)
      second.emit('change', added)
      expect(request).toHaveBeenCalledTimes(2)
      config.configFileDependencies = []
      await owner.updateDependencies()
      expect(first.close).toHaveBeenCalledOnce()
      expect(second.close).toHaveBeenCalledOnce()
    }
    finally {
      await owner.close()
    }
    expect(first.close).toHaveBeenCalledOnce()
  })

  it('drains all groups when closing during added dependency readiness without another load', async () => {
    const entry = '/project/vite.config.ts'
    const config = { inlineConfig: {}, configFileDependencies: [entry] }
    const first = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    await owner.updateDependencies()
    config.configFileDependencies = [entry, '/project/config/mini.ts']
    const added = createWatcher(false)
    const load = vi.fn(async () => {})
    const reloading = owner.reload(load, () => false)
    await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(2))
    const queuedUpdate = owner.updateDependencies()
    const closing = owner.close()
    expect(owner.close()).toBe(closing)
    await Promise.all([closing, reloading, queuedUpdate])
    expect(load).toHaveBeenCalledOnce()
    expect(first.close).toHaveBeenCalledOnce()
    expect(added.close).toHaveBeenCalledOnce()
    expect(added.listenerCount('ready')).toBe(0)
    expect(mocks.watch).toHaveBeenCalledTimes(2)
  })

  it('reloads after a ready dependency group is created following an empty configuration', async () => {
    const config = { inlineConfig: {}, configFileDependencies: ['/project/vite.config.ts'] }
    const initial = createWatcher()
    const owner = createClassicConfigWatcher(config, vi.fn())
    try {
      await owner.updateDependencies()
      config.configFileDependencies = []
      await owner.updateDependencies()
      expect(initial.close).toHaveBeenCalledOnce()
      config.configFileDependencies = ['/project/config/mini.ts']
      createWatcher()
      const load = vi.fn(async () => {})
      await owner.reload(load, () => false)
      expect(load).toHaveBeenCalledTimes(2)
      expect(owner.hasPendingChanges).toBe(false)
    }
    finally {
      await owner.close()
    }
  })
})
