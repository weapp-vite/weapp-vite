import type { Plugin } from 'vite'
import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { beginWxmlDependencies } from '../wxml/processing/dependencies'
import { createDevModuleGraphProvider } from './devProvider'
import { createModuleGraphService } from './service'

const { createServerMock, watchMock } = vi.hoisted(() => ({
  createServerMock: vi.fn(),
  watchMock: vi.fn(),
}))

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return { ...actual, createServer: createServerMock }
})
vi.mock('chokidar', () => ({ default: { watch: watchMock } }))

it('subscribes external WXML inputs to the provider and releases only its listener', async () => {
  const externalWatcher = Object.assign(new EventEmitter(), {
    add: vi.fn(),
    close: vi.fn(async () => { externalWatcher.removeAllListeners() }),
  })
  watchMock.mockImplementation(() => {
    queueMicrotask(() => externalWatcher.emit('ready'))
    return externalWatcher
  })
  const server = {
    config: { root: '/project', server: { watch: {} }, logger: { error: vi.fn() } },
    watcher: { add: vi.fn() },
    moduleGraph: {},
    close: vi.fn(async () => {}),
  }
  createServerMock.mockResolvedValue(server)
  const runtimeState = createRuntimeState()
  const dependency = '/external/transform-rules.json'
  const lateDependency = '/external/late-rules.json'
  const unrelated = vi.fn()
  runtimeState.wxmlProcessing.listeners.add(unrelated)
  const onChange = vi.fn()
  const ctx = {
    moduleGraphService: createModuleGraphService(),
    runtimeState,
    configService: { cwd: '/project', outDir: '/project/dist' },
  } as any
  const initial = beginWxmlDependencies(ctx, 'main', false)
  initial.template('initial.wxml')(dependency)
  initial.commit()
  const provider = await createDevModuleGraphProvider(ctx, {}, onChange)
  try {
    expect(watchMock).toHaveBeenCalledExactlyOnceWith(['/external'], expect.any(Object))
    expect(runtimeState.wxmlProcessing.listeners.size).toBe(2)
    externalWatcher.emit('change', dependency)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ event: 'update', file: dependency })
    const plugin = createServerMock.mock.calls[0]![0].plugins[0] as Plugin
    const read = vi.fn(async () => '{}')
    await (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type: 'update', file: dependency, read })
    expect(read).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledOnce()
    const replacement = beginWxmlDependencies(ctx, 'main', false)
    replacement.template('late.wxml')(lateDependency)
    replacement.commit()
    externalWatcher.emit('change', dependency)
    externalWatcher.emit('add', lateDependency)
    expect(onChange.mock.calls.map(([change]) => change)).toEqual([
      { event: 'update', file: dependency },
      { event: 'create', file: lateDependency },
    ])
    // 同一根外父目录只注册一次，根内文件和根外文件均不重复注册到 Vite。
    expect(externalWatcher.add).not.toHaveBeenCalled()
    expect(server.watcher.add).not.toHaveBeenCalled()
  }
  finally {
    await provider.close()
  }
  await provider.close()
  expect(runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
  expect(externalWatcher.close).toHaveBeenCalledOnce()
  expect(server.close).toHaveBeenCalledOnce()
  externalWatcher.emit('change', lateDependency)
  expect(onChange).toHaveBeenCalledTimes(2)
})
