import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-independent-host-'))
  roots.push(root)
  const files = {
    'package.json': JSON.stringify({ name: 'independent-host', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/', compileType: 'miniprogram' }),
    'vite.config.mjs': 'throw new Error("child must reuse loaded host config")',
    'weapp-vite.config.mjs': 'throw new Error("host must not load shadow config")',
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'], subPackages: [{ root: 'standalone', pages: ['pages/home/index'], independent: true }] }),
    'src/pages/home/index.ts': 'Page({})',
    'src/pages/home/index.wxml': '<view>main page</view>',
    'src/pages/home/index.json': '{}',
    'src/standalone/message.ts': 'export const message = "independent original"',
    'src/standalone/pages/home/index.ts': 'import { message } from "../../message"; Page({ data: { message } })',
    'src/standalone/pages/home/index.json': '{}',
    'src/standalone/pages/home/index.wxml': '<view>independent template {{message}}</view>',
    'src/standalone/pages/home/index.wxss': 'view { color: red; }',
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
    weapp: { srcRoot: 'src', npm: { enable: false }, hmr: { runtime: 'classic' } },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  const read = (file: string) => readFile(path.join(root, 'dist', file), 'utf8')
  const edit = (file: string, source: string) => writeFile(path.join(root, 'src', file), source)
  return { root, config, read, edit }
}

it('builds an independent target from the loaded host config without evaluating either config file', async () => {
  const { config, read } = await fixture()
  await build(config)
  expect(JSON.parse(await read('app.json')).subPackages).toEqual([{ root: 'standalone', pages: ['pages/home/index'], independent: true }])
  expect(await read('standalone/pages/home/index.wxml')).toContain('independent template')
  expect(await read('standalone/pages/home/index.js')).toContain('independent original')
  expect(await read('pages/home/index.wxml')).toContain('main page')
}, 30_000)

it('applies host user transforms to the isolated child without installing another weapp session', async () => {
  const { config, read } = await fixture()
  config.plugins!.push({
    name: 'fixture:message-transform',
    transform(code, id) {
      if (id.endsWith('/message.ts')) {
        return code.replace('independent original', 'host transform applied')
      }
    },
  })
  await build(config)
  expect(await read('standalone/pages/home/index.js')).toContain('host transform applied')
}, 30_000)

it('watches independent script and sidecar inputs through the host production watcher', async () => {
  const { root, config, read, edit } = await fixture()
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } }) as RolldownWatcher
  let rounds = 0
  const errors: unknown[] = []
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
    await edit('standalone/message.ts', 'export const message = "independent updated"')
    await expect.poll(() => read('standalone/pages/home/index.js'), { timeout: 15_000 }).toContain('independent updated')
    await edit('standalone/pages/home/index.wxml', '<view>updated template {{message}}</view>')
    await expect.poll(() => read('standalone/pages/home/index.wxml'), { timeout: 15_000 }).toContain('updated template')
    expect(errors).toEqual([])
    await edit('standalone/message.ts', 'export const message = ;')
    await expect.poll(() => errors.length, { timeout: 15_000 }).toBeGreaterThan(0)
    await edit('standalone/message.ts', 'export const message = "independent recovered"')
    await expect.poll(() => read('standalone/pages/home/index.js'), { timeout: 15_000 }).toContain('independent recovered')
    await edit('app.json', JSON.stringify({ pages: ['pages/home/index'] }))
    await expect.poll(async () => JSON.parse(await read('app.json')).subPackages ?? [], { timeout: 15_000 }).toEqual([])
    await expect.poll(() => access(path.join(root, 'dist/standalone/pages/home/index.js')).then(() => true, () => false), { timeout: 15_000 }).toBe(false)
  }
  finally {
    await watcher.close()
  }
}, 45_000)

it.each(['classic', 'stateful-experimental'] as const)('updates independent assets through %s and closes all child work', async (runtime) => {
  const { config, read, edit } = await fixture()
  config.weapp!.hmr = { runtime }
  const server = await createServer(config)
  try {
    expect(await read('standalone/pages/home/index.wxml')).toContain('independent template')
    await edit('standalone/pages/home/index.wxml', '<view>dev template {{message}}</view>')
    await expect.poll(() => read('standalone/pages/home/index.wxml'), { timeout: 15_000 }).toContain('dev template')
  }
  finally {
    await server.close()
  }
}, 30_000)

it('updates independent Vue sources outside the stateful host module graph', async () => {
  const { root, config, read } = await fixture()
  const source = path.resolve(import.meta.dirname, '../../../e2e-apps/wevu-subpackage-placement')
  await rm(path.join(root, 'src'), { recursive: true })
  await cp(path.join(source, 'src'), path.join(root, 'src'), { recursive: true })
  await symlink(path.join(source, 'node_modules'), path.join(root, 'node_modules'), 'junction')
  config.weapp!.hmr = { runtime: 'stateful-experimental' }
  const server = await createServer(config)
  try {
    const file = 'subpackages/independent-wevu/pages/entry/index'
    expect(await read(`${file}.wxml`)).toContain('__WSP_INDEPENDENT_ENTRY__')
    const original = await readFile(path.join(root, 'src', `${file}.vue`), 'utf8')
    await writeFile(path.join(root, 'src', `${file}.vue`), original.replace('__WSP_INDEPENDENT_ENTRY__', 'updated independent Vue'))
    await expect.poll(() => read(`${file}.wxml`), { timeout: 15_000 }).toContain('updated independent Vue')
  }
  finally {
    await server.close()
  }
}, 30_000)
