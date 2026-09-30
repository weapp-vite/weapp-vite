import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
const servers: ViteDevServer[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(plugins: Plugin[] = [], initialScript = 'Page({ data: { message: "initial-message" } })', setup?: (root: string) => Promise<InlineConfig>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-dev-'))
  roots.push(root)
  const files = {
    'package.json': '{"name":"dev-host-fixture","type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist"}',
    'src/app.ts': 'App({})',
    'src/app.json': '{"pages":["pages/home/index"]}',
    'src/pages/home/index.ts': initialScript,
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{message}}</view>',
    'src/pages/home/index.wxss': 'view { color: red; }',
  }
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  const overrides = await setup?.(root)
  const server = await createServer({
    root,
    configFile: false,
    plugins: [weapp(), ...plugins],
    logLevel: 'silent',
    server: { middlewareMode: true },
    weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'classic' } },
    ...overrides,
  })
  servers.push(server)
  return { root, server, read: (file: string) => readFile(path.join(root, 'dist', file), 'utf8') }
}

it('writes initial classic output and updates scripts in middleware mode', async () => {
  const { root, server, read } = await fixture()
  expect(await read('pages/home/index.js')).toContain('initial-message')
  await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: "updated-message" } })')
  await expect.poll(() => read('pages/home/index.js'), { timeout: 10_000 }).toContain('updated-message')
  await server.close()
  await server.close()
}, 30_000)

it('rejects bundled development before starting a classic host', async () => {
  await expect(fixture([], undefined, async () => ({ experimental: { bundledDev: true } })))
    .rejects
    .toThrow('暂不支持 experimental.bundledDev')
})

it('updates template/style, reports script failures, and rebuilds after correction', async () => {
  const failures: unknown[] = []
  const { root, read } = await fixture([{ name: 'observe-build-failures', buildEnd(error) {
    if (error) {
      failures.push(error)
    }
  } }])
  await writeFile(path.join(root, 'src/pages/home/index.wxml'), '<view>updated-template {{message}}</view>')
  await expect.poll(() => read('pages/home/index.wxml'), { timeout: 10_000 }).toContain('updated-template')
  await writeFile(path.join(root, 'src/pages/home/index.wxss'), 'view { color: green; }')
  await expect.poll(() => read('pages/home/index.wxss'), { timeout: 10_000 }).toContain('green')
  await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ syntax error')
  await expect.poll(() => failures.length, { timeout: 10_000 }).toBeGreaterThan(0)
  await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: "recovered-message" } })')
  await expect.poll(() => read('pages/home/index.js'), { timeout: 10_000 }).toContain('recovered-message')
}, 30_000)

it('adds and deletes page outputs and supports an explicit middleware server restart', async () => {
  const { root, server, read } = await fixture([], undefined, async () => ({ build: { sourcemap: true } }))
  await mkdir(path.join(root, 'src/pages/extra'), { recursive: true })
  await writeFile(path.join(root, 'src/pages/extra/index.ts'), 'Page({ data: { message: "extra-page" } })')
  await writeFile(path.join(root, 'src/pages/extra/index.json'), '{}')
  await writeFile(path.join(root, 'src/pages/extra/index.wxml'), '<view>{{message}}</view>')
  await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index","pages/extra/index"]}')
  await expect.poll(() => read('app.json'), { timeout: 10_000 }).toContain('pages/extra/index')
  await expect.poll(() => read('pages/extra/index.js'), { timeout: 10_000 }).toContain('extra-page')
  await expect.poll(() => read('pages/extra/index.js.map'), { timeout: 10_000 }).toContain('index.ts')
  await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index"]}')
  await rm(path.join(root, 'src/pages/extra'), { recursive: true })
  await expect.poll(() => read('app.json'), { timeout: 10_000 }).not.toContain('pages/extra/index')
  await expect.poll(async () => read('pages/extra/index.js').catch(error => error.code), { timeout: 10_000 }).toBe('ENOENT')
  await expect.poll(async () => read('pages/extra/index.js.map').catch(error => error.code), { timeout: 10_000 }).toBe('ENOENT')
  await server.restart()
  await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: "after-restart" } })')
  await expect.poll(() => read('pages/home/index.js'), { timeout: 10_000 }).toContain('after-restart')
}, 30_000)

it('keeps a recoverable host after an initial syntax failure', async () => {
  const { root, read } = await fixture([], 'Page({ syntax error')
  await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: "fixed-initial-error" } })')
  await expect.poll(() => read('pages/home/index.js'), { timeout: 10_000 }).toContain('fixed-initial-error')
}, 30_000)

it('reloads imported config exactly once through the host before rebuilding', async () => {
  const { root, read } = await fixture([], 'Page({ data: { message: CONFIG_MESSAGE } })', async (projectRoot) => {
    await writeFile(path.join(projectRoot, 'config-value.mjs'), 'export const message = "first-config"')
    const configFile = path.join(projectRoot, 'vite.config.mjs')
    await writeFile(configFile, `import { appendFileSync } from 'node:fs'
import { message } from './config-value.mjs'
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default { define: { CONFIG_MESSAGE: JSON.stringify(message) } }
`)
    return { configFile }
  })
  expect(await read('pages/home/index.js')).toContain('first-config')
  expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe('loaded\n')
  await writeFile(path.join(root, 'config-value.mjs'), 'export const message = "second-config"')
  await expect.poll(() => read('pages/home/index.js'), { timeout: 10_000 }).toContain('second-config')
  expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe('loaded\nloaded\n')
}, 30_000)

it('waits for an in-flight snapshot before closing the middleware host', async () => {
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  let hold = false
  const { root, server } = await fixture([{ name: 'hold-native-write', async writeBundle() {
    if (hold) {
      started.resolve()
      await finish.promise
    }
  } }])
  hold = true
  await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: "closing-write" } })')
  await started.promise
  const settled = vi.fn()
  const closing = server.close().then(settled)
  await Promise.resolve()
  await Promise.resolve()
  expect(settled).not.toHaveBeenCalled()
  finish.resolve()
  await closing
  expect(settled).toHaveBeenCalledOnce()
}, 30_000)

it('keeps two active hosts isolated when one closes', async () => {
  const first = await fixture()
  const second = await fixture()
  await first.server.close()
  await writeFile(path.join(second.root, 'src/pages/home/index.ts'), 'Page({ data: { message: "second-survives" } })')
  await expect.poll(() => second.read('pages/home/index.js'), { timeout: 10_000 }).toContain('second-survives')
  expect(await first.read('pages/home/index.js')).toContain('initial-message')
}, 30_000)
