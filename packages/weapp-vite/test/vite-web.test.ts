import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { CompilerSession } from '../src/runtime/compilerSession'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-web-host-'))
  roots.push(root)
  const files = {
    'package.json': JSON.stringify({ name: 'web-host-fixture', type: 'module' }),
    'index.html': '<html><body><div id="app"></div><script type="module" src="/@weapp-vite/web/entry"></script></body></html>',
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/app.wxss': 'page { color: black; }',
    'src/pages/home/index.ts': 'Page({data:{message:"web-host",count:0},increment(){this.setData({count:this.data.count+1})}})',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view id="message">{{message}}</view><button bindtap="increment">{{count}}</button>',
    'src/pages/home/index.wxss': 'view { color: red; }',
    'weapp-vite.config.mjs': 'throw new Error("must not reload standalone config")',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  await symlink(path.resolve(import.meta.dirname, '../../../templates/weapp-vite-multi-platform-sfc-template/node_modules'), path.join(root, 'node_modules'), 'junction')
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    weapp: { platform: 'web', srcRoot: 'src', web: { enable: true }, autoRoutes: false },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  return { root, config }
}

it('builds browser assets through the host without mini-program project configuration', async () => {
  const { root, config } = await fixture()
  const result = await build(config)
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('Expected Web bundle')
  }
  expect(result.output.map(item => item.fileName)).toContain('index.html')
  expect(await readFile(path.join(root, 'dist/web/index.html'), 'utf8')).toContain('<div id="app">')
  expect(await readdir(path.join(root, 'dist'))).toEqual(['web'])
  expect(result.output.some(item => item.type === 'chunk' && item.code.includes('web-host'))).toBe(true)
}, 60_000)

it('serves the Web entry through the existing middleware host and closes cleanly', async () => {
  const { root, config } = await fixture()
  const server = await createServer(config)
  try {
    const entry = await server.transformRequest('/@weapp-vite/web/entry')
    expect(entry?.code).toContain('pages/home/index')
    expect(await readdir(root)).not.toContain('dist')
    expect(server.config.weappVite?.runtime).toBe('web')
  }
  finally { await server.close() }
}, 30_000)

it('keeps standalone config Web selection and explicit CLI overrides coherent', async () => {
  const { root, config } = await fixture()
  await rm(path.join(root, 'weapp-vite.config.mjs'))
  await writeFile(path.join(root, 'vite.config.mjs'), 'export default { weapp: { platform: \'web\', srcRoot: \'src\' } }')
  const session = new CompilerSession()
  try {
    const ctx = await session.initialize({ cwd: root, mode: 'production', preloadAppEntry: false, syncSupportFiles: false })
    expect(ctx.configService.options.sourceConfig?.weapp?.platform).toBe('web')
    expect(ctx.configService.mergeWeb()?.build?.rolldownOptions?.output).not.toMatchObject({ format: 'cjs' })
    expect(ctx.configService.weappWebConfig?.enabled).toBe(true)
  }
  finally { await session.close() }
  const override = new CompilerSession()
  try {
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist' }))
    const ctx = await override.initialize({ cwd: root, mode: 'production', cliPlatform: 'weapp', inlineConfig: { weapp: { platform: 'weapp' } }, preloadAppEntry: false, syncSupportFiles: false })
    expect(ctx.configService.platform).toBe('weapp')
    expect(ctx.configService.weappWebConfig).toBeUndefined()
  }
  finally { await override.close() }
  expect(config.weapp?.platform).toBe('web')
})

it('preserves user plugin hooks once', async () => {
  const { config } = await fixture()
  let starts = 0
  config.plugins!.push({ name: 'user-web-plugin', buildStart() {
    starts++
  } })
  await build(config)
  expect(starts).toBe(1)
})

it('recovers Web transforms after invalid source and supports independent middleware hosts', async () => {
  const first = await fixture()
  const second = await fixture()
  const server = await createServer(first.config)
  const other = await createServer(second.config)
  const file = path.join(first.root, 'src/pages/home/index.ts')
  try {
    const url = '/src/pages/home/index.ts'
    expect((await server.transformRequest(url))?.code).toContain('web-host')
    await writeFile(file, 'Page({invalid:')
    server.moduleGraph.invalidateAll()
    await expect(server.transformRequest(url)).rejects.toThrow()
    await writeFile(file, 'Page({data:{message:"web-recovered"}})')
    server.moduleGraph.invalidateAll()
    expect((await server.transformRequest(url))?.code).toContain('web-recovered')
    await server.close()
    expect((await other.transformRequest(url))?.code).toContain('web-host')
  }
  finally {
    await server.close()
    await other.close()
  }
}, 30_000)

it('writes Web watch updates through native bundler output', async () => {
  const { root, config } = await fixture()
  const result = await build({ ...config, build: { ...config.build, watch: {} } })
  if (Array.isArray(result) || !('on' in result)) {
    throw new Error('Expected Web watcher')
  }
  let builds = 0
  let error: unknown
  result.on('event', (event) => {
    if (event.code === 'END') {
      builds++
    }
    if (event.code === 'ERROR') {
      error = event.error
    }
  })
  try {
    await expect.poll(() => {
      if (error) {
        throw error
      }
      return builds
    }, { timeout: 30_000 }).toBeGreaterThan(0)
    await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({data:{message:"web-watch-updated"}})')
    await expect.poll(() => {
      if (error) {
        throw error
      }
      return builds
    }, { timeout: 30_000 }).toBeGreaterThan(1)
    const files = await readdir(path.join(root, 'dist/web'), { recursive: true })
    const chunks = await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(path.join(root, 'dist/web', file), 'utf8')))
    expect(chunks.some(code => code.includes('web-watch-updated'))).toBe(true)
  }
  finally { await result.close() }
}, 60_000)
