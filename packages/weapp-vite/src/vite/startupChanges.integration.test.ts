import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weapp } from './index'

const harness = vi.hoisted(() => ({ pause: undefined as (() => Promise<void>) | undefined }))
vi.mock('../runtime/tsconfigSupport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/tsconfigSupport')>()
  return {
    ...actual,
    async syncManagedTsconfigFiles(...args: Parameters<typeof actual.syncManagedTsconfigFiles>) {
      const result = await actual.syncManagedTsconfigFiles(...args)
      await harness.pause?.()
      return result
    },
  }
})

it.each(['entry-validation', 'initial-build'] as const)('keeps source saves admitted during %s before the classic graph is ready', async (stage) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-startup-save-')))
  const appConfig = path.join(root, 'src/app.json')
  const paused = Promise.withResolvers<void>()
  const observed = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const pause = async () => {
    paused.resolve()
    await release.promise
  }
  let server: ViteDevServer | undefined
  let starting: Promise<ViteDevServer> | undefined
  let firstBuild = true
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"startup-save-fixture","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"],"window":{"navigationBarTitleText":"before-startup-save"}}',
      'src/pages/home/index.js': 'Page({})',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view>Startup save</view>',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    harness.pause = stage === 'entry-validation' ? pause : undefined
    starting = createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'classic' } },
      server: { middlewareMode: true, host: '127.0.0.1', port: 0 },
      plugins: [weapp(), {
        name: 'startup-save-admission-gate',
        async buildStart() {
          if (stage === 'initial-build' && firstBuild && this.environment.mode === 'build') {
            firstBuild = false
            await pause()
          }
        },
        hotUpdate({ file }) {
          if (path.resolve(file) === appConfig) {
            observed.resolve()
          }
        },
      }],
    })
    await Promise.race([paused.promise, starting.then(() => {
      throw new Error('Startup completed before the admission gate')
    })])
    await writeFile(appConfig, '{"pages":["pages/home/index"],"window":{"navigationBarTitleText":"saved-during-startup"}}')
    // 等到真实宿主消费文件事件，再释放扫描或首构，排除保存碰巧落在就绪后的假通过。
    await observed.promise
    release.resolve()
    server = await starting
    await expect.poll(() => readFile(path.join(root, 'dist/app.json'), 'utf8')).toContain('saved-during-startup')
  }
  finally {
    harness.pause = undefined
    release.resolve()
    server ??= await starting?.catch(() => undefined)
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})
