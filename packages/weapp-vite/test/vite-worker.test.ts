import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createBuilder, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-worker-host-'))
  roots.push(root)
  const files = {
    'package.json': '{"name":"worker-host","private":true,"type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist/","srcMiniprogramRoot":"src/","compileType":"miniprogram"}',
    'vite.config.mjs': 'throw new Error("child must not load config")',
    'src/app.ts': 'App({})',
    'src/app.json': '{"pages":["pages/home/index"],"workers":"workers"}',
    'src/pages/home/index.ts': 'Page({})',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>worker host</view>',
    'src/workers/index.ts': 'import { message } from "./message"; worker.onMessage(() => worker.postMessage(message))',
    'src/workers/message.ts': 'export const message = "worker original"',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const config: InlineConfig = {
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [weapp()],
    weapp: { srcRoot: 'src', npm: { enable: false }, worker: { entry: ['index'] }, hmr: { runtime: 'classic' } },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  const read = () => readFile(path.join(root, 'dist/workers/index.js'), 'utf8')
  const edit = (source: string) => writeFile(path.join(root, 'src/workers/message.ts'), source)
  return { root, config, read, edit }
}

it('builds the main application and worker through the native app builder without reloading config', async () => {
  const { config, read } = await fixture()
  config.plugins!.push({
    name: 'fixture:worker-transform',
    transform(code, id) {
      if (id.endsWith('/workers/message.ts')) {
        return code.replace('worker original', 'worker transformed')
      }
    },
  })
  const builder = await createBuilder(config)
  await builder.buildApp()
  expect(await read()).toContain('worker transformed')
  expect(Object.keys(builder.environments)).toContain('weapp_workers')
}, 30_000)

it('watches worker imports and recovers from a syntax error without a second worker watcher', async () => {
  const { root, config, read, edit } = await fixture()
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } }) as RolldownWatcher
  const errors: unknown[] = []
  let rounds = 0
  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') {
      rounds++
    }
    if (event.code === 'ERROR') {
      errors.push(event.error)
    }
  })
  try {
    await expect.poll(() => rounds, { timeout: 15_000 }).toBeGreaterThan(0)
    expect(await read()).toContain('worker original')
    await edit('export const message = ;')
    await expect.poll(() => errors.length, { timeout: 15_000 }).toBeGreaterThan(0)
    await edit('export const message = "worker recovered"')
    await expect.poll(read, { timeout: 15_000 }).toContain('worker recovered')
    await writeFile(path.join(root, 'src/workers/new.ts'), 'export const message = \"worker new import\"')
    await edit('export { message } from \"./new\"')
    await expect.poll(read, { timeout: 15_000 }).toContain('worker new import')
    await writeFile(path.join(root, 'src/app.json'), '{\"pages\":[\"pages/home/index\"]}')
    await expect.poll(() => access(path.join(root, 'dist/workers/index.js')).then(() => true, () => false), { timeout: 15_000 }).toBe(false)
  }
  finally { await watcher.close() }
}, 30_000)

it.each(['classic', 'stateful-experimental'] as const)('updates worker dependencies in %s and awaits shutdown', async (runtime) => {
  const { config, read, edit } = await fixture()
  config.weapp!.hmr = { runtime }
  const server = await createServer(config)
  try {
    expect(await read()).toContain('worker original')
    await edit('export const message = "worker updated"')
    await expect.poll(read, { timeout: 15_000 }).toContain('worker updated')
  }
  finally { await server.close() }
}, 30_000)
