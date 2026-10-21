import type { InlineConfig, ViteDevServer } from 'vite'
import { WEAPP_VITE_HOST_RESTART_CONFIG_KEY } from '@weapp-core/constants'
import { mergeConfig } from 'vite'
import { expect, it, vi } from 'vitest'
import { getDevServerCloseRecord } from '../devLifecycle/server'
import { bindHostLifecycle, setHostRestartData, takeHostConfigRestartData, takeHostLifecycle } from './lifecycle'

it.each([false, true])('consumes a private handoff before fresh plugin preparation after native config merging (force=%s)', async (force) => {
  const callerConfig = Object.freeze({ define: Object.freeze({ USER_VALUE: '1' }) })
  const key = Symbol('command-runtime')
  const runtime = { phase: 'classic' }
  const prepared: unknown[] = []
  const closeReplacement = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: callerConfig },
    close: vi.fn(async () => {}),
    restart: async () => {
      // 与 Vite 的两次配置合并一致：symbol 字段不参与可枚举字符串键合并。
      const config = mergeConfig(mergeConfig({}, server.config.inlineConfig), force ? { forceOptimizeDeps: true } : {})
      expect(Object.getOwnPropertySymbols(config)).toEqual([])
      expect(config[WEAPP_VITE_HOST_RESTART_CONFIG_KEY]).toEqual(expect.any(Function))
      // 每次重启模拟配置文件重新执行，创建一个全新的插件闭包。
      const createPlugin = () => {
        const inherited = takeHostLifecycle(config)
        prepared.push(takeHostConfigRestartData(inherited, key))
        expect(takeHostConfigRestartData(inherited, key)).toBeUndefined()
        expect(config).not.toHaveProperty(WEAPP_VITE_HOST_RESTART_CONFIG_KEY)
        return (replacement: ViteDevServer) => bindHostLifecycle(replacement, async () => {}, inherited)
      }
      const configure = createPlugin()
      const replacement = {
        config: { inlineConfig: config },
        close: closeReplacement,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      configure(replacement)
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, key, runtime)
  const original = getDevServerCloseRecord(server)
  await server.restart(force)
  expect(prepared).toEqual([runtime])
  expect(getDevServerCloseRecord(server)).not.toBe(original)
  expect(Reflect.ownKeys(callerConfig)).toEqual(['define'])
  expect(callerConfig.define).toEqual({ USER_VALUE: '1' })
  await Promise.all([server.close(), server.close()])
  expect(closeReplacement).toHaveBeenCalledOnce()
})

it('keeps independent hosts isolated when both reuse the same caller configuration', async () => {
  const callerConfig = Object.freeze({})
  const key = Symbol('runtime')
  const inheritedValues: unknown[] = []
  const createHost = (value: string): ViteDevServer => {
    const server = {
      config: { inlineConfig: callerConfig },
      close: vi.fn(async () => {}),
      restart: async () => {
        const config: InlineConfig = mergeConfig({}, server.config.inlineConfig)
        const inherited = takeHostLifecycle(config)
        inheritedValues.push(takeHostConfigRestartData(inherited, key))
        const replacement = {
          config: { inlineConfig: config },
          close: vi.fn(async () => {}),
          restart: vi.fn(async () => {}),
        } as unknown as ViteDevServer
        bindHostLifecycle(replacement, async () => {}, inherited)
        Object.assign(server, replacement)
      },
    } as unknown as ViteDevServer
    bindHostLifecycle(server, async () => {})
    void setHostRestartData(server, key, value)
    return server
  }
  const first = createHost('first')
  const second = createHost('second')
  await first.restart()
  await second.restart()
  expect(inheritedValues).toEqual(['first', 'second'])
  expect(takeHostLifecycle(callerConfig)).toBeUndefined()
  expect(Reflect.ownKeys(callerConfig)).toEqual([])
  await Promise.all([first.close(), second.close()])
})

it('restarts through a reloaded lifecycle module and waits for replacement shutdown without closing the old native host', async () => {
  // 配置打包重载会重新执行库模块；必须跨模块交接真实的关闭资源与重启等待。
  vi.resetModules()
  const reloaded = await import('./lifecycle')
  const preparing = Promise.withResolvers<void>()
  const ready = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  const replacementSession = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      const config: InlineConfig = mergeConfig({}, server.config.inlineConfig)
      const inherited = reloaded.takeHostLifecycle(config)
      const replacement = {
        config: { inlineConfig: config },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      reloaded.bindHostLifecycle(replacement, replacementSession, inherited)
      preparing.resolve()
      await ready.promise
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  const restarting = server.restart()
  let finished = false
  let closing: Promise<void> | undefined
  try {
    await preparing.promise
    closing = server.close().then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    expect(replacementClose).not.toHaveBeenCalled()
  }
  finally {
    ready.resolve()
    await Promise.all([restarting, closing])
  }
  expect(replacementSession).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(nativeClose).not.toHaveBeenCalled()
})

it('keeps retired environment listeners closed while replacement listeners remain active', async () => {
  const firstListen = vi.fn(async () => {})
  const replacementListen = vi.fn(async () => {})
  let switching = false
  const server = {
    config: { inlineConfig: {} },
    environments: { client: { listen: firstListen } },
    close: vi.fn(async () => {}),
    restart: async () => {
      const config: InlineConfig = mergeConfig({}, server.config.inlineConfig)
      const inherited = takeHostLifecycle(config)
      const replacement = {
        config: { inlineConfig: config },
        environments: { client: { listen: replacementListen } },
        close: vi.fn(async () => {}),
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {}, inherited)
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {}, undefined, () => switching)
  const first = server.environments.client
  await first.listen(server)
  expect(firstListen).toHaveBeenCalledOnce()
  switching = true
  await first.listen(server)
  expect(firstListen).toHaveBeenCalledOnce()
  await server.restart()
  await first.listen(server)
  await server.environments.client.listen(server)
  expect(firstListen).toHaveBeenCalledOnce()
  expect(replacementListen).toHaveBeenCalledOnce()
  await server.close()
  await server.environments.client.listen(server)
  expect(replacementListen).toHaveBeenCalledOnce()
})

it('does not revive a retired environment when both session and native cleanup fail', async () => {
  const listen = vi.fn(async () => {})
  const sessionFailure = new Error('session cleanup failed')
  const hostFailure = new Error('native host cleanup failed')
  const server = {
    config: { inlineConfig: {} },
    environments: { client: { listen } },
    close: vi.fn(async () => {
      throw hostFailure
    }),
    restart: vi.fn(async () => {}),
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {
    throw sessionFailure
  })
  const closing = server.close()
  await server.environments.client.listen(server)
  await expect(closing).rejects.toMatchObject({ errors: [sessionFailure, hostFailure] })
  await server.environments.client.listen(server)
  expect(listen).not.toHaveBeenCalled()
})
