import type { InlineConfig, ViteDevServer } from 'vite'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevViteServer } from '../../../../devLifecycle/vite'
import { mergeWeb } from './web'

function webConfig(config: InlineConfig = {}, userConfig?: InlineConfig, isDev = true) {
  return mergeWeb({
    config,
    web: {
      enabled: true,
      root: config.root ?? path.resolve('web-watch-fixture'),
      outDir: path.resolve('web-watch-fixture/dist'),
      srcDir: 'src',
      pluginOptions: { srcDir: 'src' },
      userConfig,
    },
    mode: 'development',
    isDev,
    applyRuntimePlatform: vi.fn(),
    injectBuiltinAliases: vi.fn(),
    getDefineImportMetaEnv: () => ({}),
  })!
}

describe('Web source write delivery', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the native Vite write-settlement policy for rapid saves', () => {
    expect(webConfig().server?.watch?.awaitWriteFinish).toEqual({ stabilityThreshold: 50, pollInterval: 10 })
  })

  it.each([false, true, { stabilityThreshold: 120, pollInterval: 30 }] as const)('preserves an explicit write-settlement policy %j', (awaitWriteFinish) => {
    expect(webConfig({ server: { watch: { awaitWriteFinish } } }).server?.watch?.awaitWriteFinish).toEqual(awaitWriteFinish)
    expect(webConfig({}, { server: { watch: { awaitWriteFinish } } }).server?.watch?.awaitWriteFinish).toEqual(awaitWriteFinish)
  })

  it('preserves disabled watching and independent watcher options', () => {
    expect(webConfig({ server: { watch: null } }).server?.watch).toBeNull()
    expect(webConfig({}, { server: { watch: null } }).server?.watch).toBeNull()
    expect(webConfig({ server: { watch: { usePolling: true, interval: 17, ignored: ['**/generated/**'] } } }).server?.watch).toMatchObject({
      usePolling: true,
      interval: 17,
      ignored: ['**/generated/**'],
    })
  })

  it('keeps an explicit higher-priority watch disable over lower-priority defaults', () => {
    expect(webConfig({ server: { watch: null } }, { server: { watch: { usePolling: true } } }).server?.watch).toBeNull()
    expect(webConfig({ server: { watch: {} } }, { server: { watch: null } }).server?.watch?.awaitWriteFinish).toEqual({ stabilityThreshold: 50, pollInterval: 10 })
  })

  it('does not mutate caller-owned server or watcher options', () => {
    const config: InlineConfig = { server: Object.freeze({ watch: Object.freeze({ usePolling: true }) }) }
    const result = webConfig(config)
    expect(config.server).toEqual({ watch: { usePolling: true } })
    expect(result.server).not.toBe(config.server)
    expect(result.server?.watch).not.toBe(config.server?.watch)
  })

  it('leaves production watcher configuration untouched', () => {
    expect(webConfig({}, undefined, false).server?.watch?.awaitWriteFinish).toBeUndefined()
  })

  it.each(['1', 'true', '0', 'false'])('normalizes the %s polling environment before Vite selects its backend', (usePolling) => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', usePolling)
    vi.stubEnv('CHOKIDAR_INTERVAL', '23')
    vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', '41')
    expect(webConfig().server?.watch).toMatchObject({
      usePolling: usePolling === '1' || usePolling === 'true',
      interval: 23,
      binaryInterval: 41,
    })
  })

  it.each([false, true])('preserves explicit polling %s and intervals over environment defaults', (usePolling) => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', usePolling ? '0' : '1')
    vi.stubEnv('CHOKIDAR_INTERVAL', '23')
    vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', '41')
    const watch = { usePolling, interval: 17, binaryInterval: 29, useFsEvents: false }
    expect(webConfig({ server: { watch } }).server?.watch).toMatchObject(watch)
    expect(webConfig({}, { server: { watch } }).server?.watch).toMatchObject(watch)
  })

  it('keeps environment defaults out of disabled watching and production configuration', () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', '1')
    vi.stubEnv('CHOKIDAR_INTERVAL', '23')
    expect(webConfig({ server: { watch: null } }).server?.watch).toBeNull()
    expect(webConfig({}, { server: { watch: null } }).server?.watch).toBeNull()
    expect(webConfig({}, undefined, false).server?.watch).toBeUndefined()
    expect(webConfig({ server: { watch: { usePolling: false } } }, undefined, false).server?.watch).toEqual({ usePolling: false })
  })

  it.each(['options', 'environment'] as const)('delivers immediate saves through the selected Vite polling backend (%s)', async (selection) => {
    const container = await realpath(await mkdtemp(path.join(os.tmpdir(), 'web-save-delivery-')))
    const root = path.join(container, 'project')
    const source = path.join(root, 'source.txt')
    let server: ViteDevServer | undefined
    let phase = 'initial scan'
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(new Error(`Vite watcher did not finish ${phase}`)), 10_000)
    try {
      // 物理 watcher 会从逻辑根的父目录扫描，必须让整个扫描范围归本测试独占。
      await mkdir(root)
      await writeFile(source, 'original')
      if (selection === 'environment') {
        vi.stubEnv('CHOKIDAR_USEPOLLING', '1')
        vi.stubEnv('CHOKIDAR_INTERVAL', '5')
      }
      const config = webConfig({ root, server: selection === 'options' ? { watch: { usePolling: true, interval: 5 } } : undefined })
      server = await createDevViteServer({
        root,
        configFile: false,
        logLevel: 'silent',
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { ...config.server, middlewareMode: true, hmr: false },
      })
      const watcher = server.watcher
      expect(watcher.options.usePolling).toBe(true)
      expect(watcher.options.useFsEvents).toBe(false)
      expect(watcher.getWatched()[root]).toContain('source.txt')
      await server.transformRequest('/source.txt?raw')
      phase = 'update'
      const updated = once(watcher, 'change', { signal: abort.signal })
      await writeFile(source, 'updated')
      expect((await updated)[0]).toBe(source)
      expect(await readFile(source, 'utf8')).toBe('updated')
      await expect.poll(async () => (await server!.transformRequest('/source.txt?raw'))?.code).toContain('updated')
      phase = 'restore'
      const restored = once(watcher, 'change', { signal: abort.signal })
      await writeFile(source, 'original')
      expect((await restored)[0]).toBe(source)
      expect(await readFile(source, 'utf8')).toBe('original')
      await expect.poll(async () => (await server!.transformRequest('/source.txt?raw'))?.code).toContain('original')
    }
    finally {
      clearTimeout(timeout)
      abort.abort()
      try {
        await server?.close()
      }
      finally {
        await rm(container, { recursive: true, force: true })
      }
    }
  }, 30_000)
})
