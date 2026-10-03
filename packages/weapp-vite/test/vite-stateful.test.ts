import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE } from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../src/vite'

interface TestDevEngine {
  close: () => Promise<void>
}

it('hands the validated topology snapshot to the replacement native host without compiling it twice', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-topology-handoff-'))
  let server: ViteDevServer | undefined
  let snapshots = 0
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"topology-handoff-fixture","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.js': 'Page({})',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view>home</view>',
      'src/pages/extra/index.js': 'Page({ data: { message: "handoff-added-page" } })',
      'src/pages/extra/index.json': '{}',
      'src/pages/extra/index.wxml': '<view>extra</view>',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp(), {
        name: 'test:snapshot-build-count',
        buildStart() {
          if (this.environment.mode === 'build') {
            snapshots++
          }
        },
      }],
      server: { middlewareMode: true, port: 0, host: '127.0.0.1' },
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
    })
    expect(snapshots).toBe(1)
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index","pages/extra/index"]}')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/extra/index.js'), 'utf8'), { timeout: 15_000 }).toContain('handoff-added-page')
    expect(JSON.parse(await readFile(path.join(root, 'dist/pages/extra/index.json'), 'utf8')) as unknown).toEqual({})
    expect(await readFile(path.join(root, 'dist/pages/extra/index.wxml'), 'utf8')).toContain('extra')
    await server.close()
    expect(JSON.parse(await readFile(path.join(root, 'project.private.config.json'), 'utf8')) as unknown).toEqual({ setting: { compileHotReLoad: true } })
    expect(snapshots).toBe(2)
  }
  finally {
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 90_000)

it.each([
  { middlewareMode: true, holdReplacement: false },
  { middlewareMode: false, holdReplacement: false },
  { middlewareMode: true, holdReplacement: true },
  { middlewareMode: false, holdReplacement: true },
])('starts stateful in the native host, updates topology and closes (middleware: $middlewareMode, hold replacement: $holdReplacement)', async ({ middlewareMode, holdReplacement }) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-stateful-host-'))
  let server: ViteDevServer | undefined
  const replacementReady = Promise.withResolvers<void>()
  const releaseReplacement = Promise.withResolvers<void>()
  let starts = 0
  let restartRequestedDuringReplacement = false
  const engines = new Set<TestDevEngine>()
  const closedEngines = new Set<TestDevEngine>()
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"stateful-host-fixture","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.ts': 'App({})',
      'config-value.mjs': 'export const message = "stateful-first"',
      'vite.config.mjs': `import { appendFileSync } from 'node:fs'
import { message } from './config-value.mjs'
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default { define: { STATEFUL_MESSAGE: JSON.stringify(message) } }`,
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.ts': 'Page({ data: { message: STATEFUL_MESSAGE } })',
      'src/pages/home/index.wxml': '<view>{{message}}</view>',
      'src/pages/home/index.json': '{}',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    const start = () => createServer({
      root,
      configFile: path.join(root, 'vite.config.mjs'),
      plugins: [weapp(), {
        name: 'test:hold-topology-replacement',
        enforce: 'post',
        async configureServer(replacement) {
          const engine = (replacement.environments.client as unknown as { bundledDev: { _devEngine: TestDevEngine } }).bundledDev._devEngine
          engines.add(engine)
          const close = engine.close.bind(engine)
          engine.close = async () => {
            await close()
            closedEngines.add(engine)
          }
          if (!holdReplacement || ++starts !== 2) {
            return
          }
          const restart = replacement.restart.bind(replacement)
          replacement.restart = (...args) => {
            restartRequestedDuringReplacement = true
            return restart(...args)
          }
          // 新产物已发布，但父重启仍在等待 configureServer；用门闩固定连续保存窗口。
          replacementReady.resolve()
          await releaseReplacement.promise
        },
      }],
      logLevel: 'silent',
      server: { middlewareMode, port: 0, host: '127.0.0.1' },
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
    })
    server = await start()
    if (!middlewareMode) {
      await server.listen()
      const address = server.httpServer!.address() as { port: number }
      expect(await readFile(path.join(root, 'dist', WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')).toContain(`localhost:${address.port}`)
    }
    expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe('loaded\n')
    expect(server.config.experimental.bundledDev).toBe(true)
    expect(await readFile(path.join(root, 'dist/app.js'), 'utf8')).toContain('rolldown-runtime')
    expect(await readFile(path.join(root, 'dist/pages/home/index.js'), 'utf8')).toContain('stateful-first')
    await writeFile(path.join(root, 'src/pages/home/index.wxml'), '<view>stateful-template {{message}}</view>')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/home/index.wxml'), 'utf8'), { timeout: 10_000 }).toContain('stateful-template')
    await mkdir(path.join(root, 'src/pages/extra'), { recursive: true })
    await writeFile(path.join(root, 'src/pages/extra/index.ts'), 'Page({ data: { message: "stateful-added" } })')
    await writeFile(path.join(root, 'src/pages/extra/index.json'), '{}')
    await writeFile(path.join(root, 'src/pages/extra/index.wxml'), '<view>{{message}}</view>')
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index","pages/extra/index"]}')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/extra/index.js'), 'utf8'), { timeout: 15_000 }).toContain('stateful-added')
    if (holdReplacement) {
      await replacementReady.promise
    }
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index"]}')
    await rm(path.join(root, 'src/pages/extra'), { recursive: true })
    if (holdReplacement) {
      await expect.poll(() => restartRequestedDuringReplacement, { timeout: 15_000 }).toBe(true)
      releaseReplacement.resolve()
    }
    await expect.poll(() => readFile(path.join(root, 'dist/app.json'), 'utf8'), { timeout: 15_000 }).not.toContain('pages/extra/index')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/extra/index.js'), 'utf8').catch(error => error.code), { timeout: 15_000 }).toBe('ENOENT')
    await server.restart()
    if (holdReplacement) {
      await server.restart(true)
    }
    await writeFile(path.join(root, 'src/pages/home/index.wxml'), '<view>stateful-restarted {{message}}</view>')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/home/index.wxml'), 'utf8'), { timeout: 10_000 }).toContain('stateful-restarted')
    const callsBefore = await readFile(path.join(root, 'config-calls.txt'), 'utf8')
    await writeFile(path.join(root, 'config-value.mjs'), 'export const message = "stateful-new-config"')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/home/index.js'), 'utf8'), { timeout: 15_000 }).toContain('stateful-new-config')
    expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe(`${callsBefore}loaded\n`)
    await server.close()
    await server.close()
    expect(closedEngines.size).toBe(engines.size)
    await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ syntax error')
    await expect(start()).rejects.toThrow()
    await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: STATEFUL_MESSAGE } })')
    server = await start()
    expect(await readFile(path.join(root, 'dist/pages/home/index.js'), 'utf8')).toContain('stateful-new-config')
    await server.close()
    expect(closedEngines.size).toBe(engines.size)
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index"],"renderer":"skyline"}')
    await expect(start()).rejects.toThrow('Skyline 项目请显式选择')
  }
  finally {
    releaseReplacement.resolve()
    await server?.close()
    await Promise.all([...engines].filter(engine => !closedEngines.has(engine)).map(engine => engine.close()))
    await rm(root, { recursive: true, force: true })
  }
}, 90_000)
