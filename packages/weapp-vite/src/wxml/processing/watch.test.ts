import type { FSWatcher } from 'chokidar'
import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { beginWxmlDependencies } from './dependencies'
import { bindWxmlDependencyWatch, ownsExternalWxmlWatch } from './watch'

const { watchMock } = vi.hoisted(() => ({ watchMock: vi.fn() }))
vi.mock('chokidar', () => ({ watch: watchMock }))

beforeEach(() => watchMock.mockReset())

function fixture(disabled = false) {
  const watcher = Object.assign(new EventEmitter(), {
    add: vi.fn(() => { queueMicrotask(() => watcher.emit('ready')) }),
    close: vi.fn(async () => {}),
  })
  watchMock.mockReturnValue(watcher as unknown as FSWatcher)
  const userIgnored = vi.fn(() => false)
  const server = {
    config: { root: '/project', server: { watch: disabled ? null : { usePolling: true, interval: 30, ignored: userIgnored } }, logger: { error: vi.fn() } },
    watcher: { add: vi.fn() },
  }
  const ctx = { runtimeState: createRuntimeState(), configService: { cwd: '/project', outDir: '/project/dist' } } as unknown as CompilerContext
  const internal = '/project/rules.json'
  const external = '/inputs/rules.json'
  const initial = beginWxmlDependencies(ctx, 'main', false)
  const register = initial.template('initial.wxml')
  register(internal)
  register(external)
  initial.commit()
  const onChange = vi.fn()
  const close = bindWxmlDependencyWatch(ctx, server as unknown as ViteDevServer, onChange)
  return { watcher, userIgnored, server, ctx, internal, external, onChange, close }
}

describe('WXML dependency watcher ownership', () => {
  it('leaves root dependencies with the host through publication, removal and teardown', async () => {
    const { close, ctx, internal, server } = fixture()
    await close.ready
    const missing = '/project/missing-rules.json'
    try {
      // 缺失输入保留订阅以等待恢复，但不能反复创建与宿主根监听重叠的异步注册。
      for (const files of [[internal, missing], [missing], [internal, missing], []]) {
        for (const listener of ctx.runtimeState.wxmlProcessing.listeners) {
          listener(files)
        }
      }
    }
    finally {
      await close()
    }
    expect(server.watcher.add).not.toHaveBeenCalled()
  })

  it('watches only exact external inputs through shallow parents and preserves user options', async () => {
    const { watcher, userIgnored, server, ctx, internal, external, onChange, close } = fixture()
    await close.ready
    expect(server.watcher.add).not.toHaveBeenCalled()
    expect(watcher.add).toHaveBeenCalledExactlyOnceWith('/inputs')
    const options = watchMock.mock.calls[0]![1]
    expect(options).toMatchObject({ depth: 0, ignoreInitial: true, usePolling: true, interval: 30 })
    expect(options.ignored[0]).toBe(userIgnored)
    const ignored = options.ignored[1]
    expect(ignored('/inputs')).toBe(false)
    expect(ignored(external)).toBe(false)
    expect(ignored('/inputs/unrelated.json')).toBe(false)
    expect(ignored('/inputs/nested', { isDirectory: () => true })).toBe(true)
    expect(ignored('/inputs/nested/rules.json')).toBe(true)
    expect(ownsExternalWxmlWatch(ctx, external)).toBe(true)
    expect(ownsExternalWxmlWatch(ctx, internal)).toBe(false)
    expect(ownsExternalWxmlWatch(ctx, '/inputs/unrelated.json')).toBe(false)
    watcher.emit('all', 'unlink', external)
    watcher.emit('all', 'add', external)
    watcher.emit('all', 'change', '/inputs/unrelated.json')
    expect(onChange.mock.calls.map(([event]) => event)).toEqual([
      { event: 'delete', file: external },
      { event: 'create', file: external },
    ])
    await close()
  })

  it('stops accepting released dependencies and disposes only its own subscription once', async () => {
    const { watcher, ctx, external, onChange, close } = fixture()
    await close.ready
    const unrelated = vi.fn()
    ctx.runtimeState.wxmlProcessing.listeners.add(unrelated)
    const replacement = beginWxmlDependencies(ctx, 'main', false)
    replacement.template('next.wxml')('/inputs/next.json')
    replacement.commit()
    watcher.emit('all', 'change', external)
    watcher.emit('all', 'change', '/inputs/next.json')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ event: 'update', file: '/inputs/next.json' })
    await close()
    await close()
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(ctx.runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
    expect(ownsExternalWxmlWatch(ctx, '/inputs/next.json')).toBe(false)
    watcher.emit('all', 'change', '/inputs/next.json')
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('preserves previous owners on incremental registration and releases only replaced templates', async () => {
    const { watcher, ctx, external, onChange, close } = fixture()
    await close.ready
    try {
      const next = '/inputs/next.json'
      const partial = beginWxmlDependencies(ctx, 'main', true)
      partial.template('next.wxml')(next)
      partial.commit()
      expect(ownsExternalWxmlWatch(ctx, external)).toBe(true)
      expect(ownsExternalWxmlWatch(ctx, next)).toBe(true)
      watcher.emit('all', 'change', external)
      watcher.emit('all', 'change', next)
      expect(onChange).toHaveBeenCalledTimes(2)

      const replacement = beginWxmlDependencies(ctx, 'main', true)
      replacement.template('initial.wxml')
      replacement.commit()
      expect(ownsExternalWxmlWatch(ctx, external)).toBe(false)
      expect(ownsExternalWxmlWatch(ctx, next)).toBe(true)
      watcher.emit('all', 'change', external)
      watcher.emit('all', 'change', next)
      expect(onChange).toHaveBeenCalledTimes(3)
      expect(watcher.add).toHaveBeenCalledExactlyOnceWith('/inputs')
    }
    finally {
      await close()
    }
  })

  it('respects disabled host watching', async () => {
    const { close } = fixture(true)
    await close.ready
    expect(watchMock).not.toHaveBeenCalled()
    await close()
  })
})
