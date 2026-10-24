import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weapp } from './index'

// 模拟具有增量能力的底层宿主，保留 stateful 交接覆盖；真实微信启动准入另测。
vi.mock('../runtime/hmrRuntimeHostCapabilities', () => ({
  resolveStatefulHmrStartupFallback: () => undefined,
}))

it('waits for the first classic publication during capability fallback before closing each host once', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-close-')))
  const releasePublication = Promise.withResolvers<void>()
  const trace: string[] = []
  const hosts: Array<{
    watcher: ViteDevServer['watcher']
    watcherCloseCalls: () => number
    wsCloseCalls: () => number
    restore: () => void
  }> = []
  let server: ViteDevServer | undefined
  let closing: Promise<void> | undefined
  let fallbackRequested = false
  let blockClassicPublication = false
  let publicationBlocked = false
  let publicationWritten = false
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"classic-close-fixture","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.js': 'Page({ data: { marker: "classic-close-page" } })',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view>{{marker}}</view>',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
      server: { middlewareMode: true, host: '127.0.0.1', port: 0 },
      plugins: [weapp(), {
        name: 'classic-transition-close-gate',
        configResolved(config) {
          if (fallbackRequested && config.command === 'serve' && config.experimental.bundledDev === false) {
            blockClassicPublication = true
          }
        },
        configureServer(host) {
          const watcherClose = vi.spyOn(host.watcher, 'close')
          const wsClose = vi.spyOn(host.ws, 'close')
          hosts.push({
            watcher: host.watcher,
            watcherCloseCalls: () => watcherClose.mock.calls.length,
            wsCloseCalls: () => wsClose.mock.calls.length,
            restore() {
              watcherClose.mockRestore()
              wsClose.mockRestore()
            },
          })
        },
        async generateBundle() {
          if (!blockClassicPublication || this.environment.mode !== 'build') {
            return
          }
          blockClassicPublication = false
          publicationBlocked = true
          trace.push('classic-publication-blocked')
          await releasePublication.promise
        },
        writeBundle() {
          if (publicationBlocked && !publicationWritten) {
            publicationWritten = true
            trace.push('classic-publication-written')
          }
        },
      }],
    })
    expect(server.config.experimental.bundledDev).toBe(true)
    expect(hosts).toHaveLength(1)

    fallbackRequested = true
    await writeFile(path.join(root, 'src/pages/home/index.json'), '{"navigationBarTitleText":"classic-close-transition"}')
    await expect.poll(() => publicationBlocked, { timeout: 15_000 }).toBe(true)
    expect(publicationWritten).toBe(false)

    // 真实能力回退已进入下一代首构，写出仍被门闩阻挡；此时关闭原公开宿主。
    trace.push('close-requested')
    closing = server.close()
    expect(server.close()).toBe(closing)
    let closeSettled = false
    void closing.then(() => {
      closeSettled = true
    }, () => {
      closeSettled = true
    })
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(closeSettled).toBe(false)
    expect(publicationWritten).toBe(false)

    releasePublication.resolve()
    await closing
    trace.push('close-complete')
    expect(trace).toEqual([
      'classic-publication-blocked',
      'close-requested',
      'classic-publication-written',
      'close-complete',
    ])
    expect(await readFile(path.join(root, 'dist/pages/home/index.json'), 'utf8')).toContain('classic-close-transition')
    expect(hosts).toHaveLength(2)
    expect(server.config.experimental.bundledDev).toBe(false)
    await Promise.all([server.close(), server.close()])
    for (const host of hosts) {
      expect(host.watcherCloseCalls()).toBe(1)
      expect(host.wsCloseCalls()).toBe(1)
      expect(host.watcher.getWatched()).toEqual({})
    }
    expect(JSON.parse(await readFile(path.join(root, 'project.private.config.json'), 'utf8')) as unknown).toEqual({ setting: { compileHotReLoad: true } })
  }
  finally {
    releasePublication.resolve()
    await closing?.catch(() => {})
    try {
      await server?.close()
    }
    finally {
      for (const host of hosts) {
        host.restore()
      }
      await rm(root, { recursive: true, force: true })
    }
  }
}, 60_000)
