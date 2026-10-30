import type { InlineConfig, ViteDevServer } from 'vite'
import { once } from 'node:events'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { mergeWeb } from './web'

function webConfig(config: InlineConfig = {}, userConfig?: InlineConfig, isDev = true) {
  return mergeWeb({
    config,
    web: {
      enabled: true,
      root: config.root ?? path.resolve('web-watch-fixture'),
      outDir: path.resolve('web-watch-fixture/dist'),
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

  it('delivers a restore saved immediately after the previous change through the same Vite watcher', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'web-save-delivery-')))
    const source = path.join(root, 'source.txt')
    let server: ViteDevServer | undefined
    let phase = 'initial scan'
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(new Error(`Vite watcher did not finish ${phase}`)), 10_000)
    try {
      await writeFile(source, 'original')
      const config = webConfig({ root, server: { watch: { usePolling: true, interval: 5 } } })
      server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { ...config.server, middlewareMode: true, hmr: false },
      })
      const watcher = server.watcher as ViteDevServer['watcher'] & { _readyEmitted?: boolean }
      if (!watcher._readyEmitted) {
        await once(watcher, 'ready', { signal: abort.signal })
      }
      phase = 'update'
      const updated = once(watcher, 'change', { signal: abort.signal })
      await writeFile(source, 'updated')
      expect((await updated)[0]).toBe(source)
      expect(await readFile(source, 'utf8')).toBe('updated')
      phase = 'restore'
      const restored = once(watcher, 'change', { signal: abort.signal })
      await writeFile(source, 'original')
      expect((await restored)[0]).toBe(source)
      expect(await readFile(source, 'utf8')).toBe('original')
    }
    finally {
      clearTimeout(timeout)
      abort.abort()
      await server?.close()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
