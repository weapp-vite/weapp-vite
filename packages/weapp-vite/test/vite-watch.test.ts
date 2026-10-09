import type { RolldownWatcher } from 'rolldown'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'
import { weapp } from '../src/vite'

it.each([
  { emptyOutDir: true, autoRoutes: false, initialError: false },
  { emptyOutDir: false, autoRoutes: false, initialError: true },
  { emptyOutDir: false, autoRoutes: true, initialError: false },
])('keeps native build watch alive with emptyOutDir=$emptyOutDir and autoRoutes=$autoRoutes', async ({ emptyOutDir, autoRoutes, initialError }) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-watch-'))
  let watcher: RolldownWatcher | undefined
  const errors: unknown[] = []
  const nativeEvents: string[] = []
  let lastWrite = 'fixture setup'
  const writeStarted = Promise.withResolvers<void>()
  const writeRelease = Promise.withResolvers<void>()
  let recoveryWriteHeld = false
  const recoveryWriteRelease = Promise.withResolvers<void>()
  let holdRecoveryWrite = initialError
  let holdWrite = false
  const write = async (file: string, content: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    lastWrite = file
    await writeFile(path.join(root, file), content)
  }
  const output = (file: string) => readFile(path.join(root, 'dist', file), 'utf8')
  const assertComplete = async (pages: string[]) => {
    await expect.poll(async () => {
      const app = JSON.parse(await output('app.json')) as { pages: string[] }
      for (const page of pages) {
        for (const extension of ['js', 'js.map', 'json', 'wxml']) {
          await output(`${page}.${extension}`)
        }
      }
      await output('app.js')
      if (pages.includes('pages/home/index')) {
        await output('pages/home/index.wxss')
      }
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        await output(`miniprogram_npm/mini-card/index.${extension}`)
      }
      return app.pages.slice().sort()
    }, { timeout: 10_000 }).toEqual(pages.slice().sort())
  }
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"watch-host-fixture","type":"module","dependencies":{"mini-card":"1.0.0"}}',
      'node_modules/mini-card/package.json': '{"name":"mini-card","version":"1.0.0","main":"miniprogram/index.js","miniprogram":"miniprogram"}',
      'node_modules/mini-card/miniprogram/index.js': 'Component({})',
      'node_modules/mini-card/miniprogram/index.json': '{"component":true}',
      'node_modules/mini-card/miniprogram/index.wxml': '<view>npm-card</view>',
      'node_modules/mini-card/miniprogram/index.wxss': 'view { color: green; }',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.ts': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.ts': initialError ? 'Page({ syntax error' : 'Page({ data: { message: "watch-first" } })',
      'src/pages/home/index.wxss': 'view { color: red; }',
      'src/pages/home/index.wxml': '<view>{{message}}</view>',
      'src/pages/home/index.json': '{}',
    })) {
      await write(file, content)
    }
    watcher = await build({
      root,
      configFile: false,
      plugins: [weapp(), {
        name: 'hold-native-write',
        watchChange(id, change) {
          nativeEvents.push(`${change.event}:${path.relative(root, id).replaceAll('\\', '/')}`)
        },
        async writeBundle() {
          // 首次恢复已经写出文件但尚未结束时，下一次编辑仍必须进入原生队列。
          if (holdRecoveryWrite) {
            holdRecoveryWrite = false
            recoveryWriteHeld = true
            await recoveryWriteRelease.promise
          }
          if (holdWrite) {
            writeStarted.resolve()
            await writeRelease.promise
          }
        },
      }],
      logLevel: 'silent',
      weapp: { srcRoot: 'src', autoRoutes, vue: { enable: false } },
      build: { watch: {}, emptyOutDir, minify: false, sourcemap: true },
    }) as RolldownWatcher
    watcher.on('event', (event) => {
      nativeEvents.push(event.code)
      if (event.code === 'ERROR') {
        errors.push(event.error)
      }
    })
    if (initialError) {
      await expect.poll(() => errors.length, { timeout: 10_000 }).toBeGreaterThan(0)
      await write('src/pages/home/index.ts', 'Page({ data: { message: "watch-first" } })')
      await expect.poll(() => recoveryWriteHeld, { timeout: 10_000 }).toBe(true)
    }
    await expect.poll(() => output('pages/home/index.js'), { timeout: 10_000 }).toContain('watch-first')
    await assertComplete(['pages/home/index'])
    if (!emptyOutDir) {
      await write('dist/unowned.txt', 'owned-by-another-tool')
    }
    await write('src/pages/home/index.ts', 'Page({ data: { message: "watch-second" } })')
    recoveryWriteRelease.resolve()
    await expect.poll(() => output('pages/home/index.js'), { timeout: 10_000 }).toContain('watch-second')
    await assertComplete(['pages/home/index'])
    await write('src/pages/home/index.wxml', '<view>watch-template {{message}}</view>')
    await expect.poll(() => output('pages/home/index.wxml'), { timeout: 10_000 }).toContain('watch-template')
    await assertComplete(['pages/home/index'])
    await write('src/pages/home/index.wxss', 'view { color: blue; }')
    await expect.poll(() => output('pages/home/index.wxss'), { timeout: 10_000 }).toContain('blue')
    await assertComplete(['pages/home/index'])
    await write('src/pages/extra/index.ts', 'Page({ data: { message: "watch-extra" } })')
    await write('src/pages/extra/index.wxml', '<view>{{message}}</view>')
    await write('src/pages/extra/index.json', '{"navigationBarTitleText":"Extra"}')
    if (!autoRoutes) {
      await write('src/app.json', '{"pages":["pages/home/index","pages/extra/index"]}')
    }
    await expect.poll(() => output('pages/extra/index.js'), { timeout: 10_000 }).toContain('watch-extra')
    await assertComplete(['pages/home/index', 'pages/extra/index'])
    if (!autoRoutes) {
      await write('src/app.json', '{"pages":["pages/home/index"]}')
    }
    await rm(path.join(root, 'src/pages/extra'), { recursive: true })
    await expect.poll(() => output('app.json'), { timeout: 10_000 }).not.toContain('pages/extra/index')
    await expect.poll(() => output('pages/extra/index.js').catch(error => error.code), { timeout: 10_000 }).toBe('ENOENT')
    await expect.poll(() => output('pages/extra/index.js.map').catch(error => error.code), { timeout: 10_000 }).toBe('ENOENT')
    await assertComplete(['pages/home/index'])
    const syntaxErrors = errors.length
    await write('src/pages/home/index.ts', 'Page({ syntax error')
    await expect.poll(() => errors.length, { timeout: 10_000 }).toBeGreaterThan(syntaxErrors)
    await write('src/pages/home/index.ts', 'Page({ data: { message: "watch-recovered" } })')
    await expect.poll(() => output('pages/home/index.js'), { timeout: 10_000 }).toContain('watch-recovered')
    await assertComplete(['pages/home/index'])
    const priorErrors = errors.length
    await write('src/app.json', '{"pages":["pages/home/index"],"workers":"workers"}')
    await expect.poll(() => errors.length, { timeout: 10_000 }).toBeGreaterThan(priorErrors)
    expect(await output('app.json').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error))).not.toContain('workers')
    await write('src/app.json', '{"pages":["pages/home/index"],"window":{"navigationBarTitleText":"watch-config-recovered"}}')
    await expect.poll(() => output('app.json'), { timeout: 10_000 }).toContain('watch-config-recovered')
    await assertComplete(['pages/home/index'])
    if (!emptyOutDir) {
      expect(await output('unowned.txt')).toBe('owned-by-another-tool')
    }
    await write('src/pages/replacement/index.ts', 'Page({ data: { message: "replacement" } })')
    await write('src/pages/replacement/index.wxml', '<view>{{message}}</view>')
    await write('src/pages/replacement/index.json', '{}')
    await write('src/app.json', '{"pages":["pages/replacement/index"]}')
    await rm(path.join(root, 'src/pages/home'), { recursive: true })
    await expect.poll(() => output('pages/replacement/index.js'), { timeout: 10_000 }).toContain('replacement')
    await assertComplete(['pages/replacement/index'])
    await expect.poll(() => output('pages/home/index.js').catch(error => error.code), { timeout: 10_000 }).toBe('ENOENT')
    holdWrite = true
    await write('src/pages/replacement/index.ts', 'Page({ data: { message: "closing-write" } })')
    await writeStarted.promise
    const settled = vi.fn()
    const closing = watcher.close().then(settled)
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    writeRelease.resolve()
    await closing
    expect(settled).toHaveBeenCalledOnce()
    await watcher.close()
  }
  catch (cause) {
    throw new Error(`Native watch state: ${JSON.stringify({ lastWrite, nativeEvents, failures: errors.length })}`, { cause })
  }
  finally {
    recoveryWriteRelease.resolve()
    writeRelease.resolve()
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
