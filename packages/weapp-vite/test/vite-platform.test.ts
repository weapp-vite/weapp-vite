import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { getPlatformOutputExtensions, getProjectPlatformOptions, getSupportedMiniProgramPlatforms } from '../src/platform'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(platform: ReturnType<typeof getSupportedMiniProgramPlatforms>[number]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-platform-'))
  roots.push(root)
  const extensions = getPlatformOutputExtensions(platform)
  const files = {
    'package.json': JSON.stringify({ name: 'platform-consumer', type: 'module' }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/pages/home/index.ts': 'Page({data:{message:"platform-host"}})',
    'src/pages/home/index.json': '{}',
    [`src/pages/home/index.${extensions.wxml}`]: '<view>{{message}}</view>',
    [`src/pages/home/index.${extensions.wxss}`]: 'view { color: red; }',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    weapp: {
      platform,
      srcRoot: 'src',
      vue: { enable: false },
      autoRoutes: false,
      hmr: { runtime: 'classic' },
      multiPlatform: { targets: [platform], projectConfigs: { [platform]: { appid: 'fixture-app' } } },
    },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  const out = path.join(root, 'dist', platform, 'dist')
  const read = (file: string) => readFile(path.join(out, file), 'utf8')
  return { root, config, read, extensions }
}

it.each(getSupportedMiniProgramPlatforms())('builds %s selected by top-level config with native project metadata', async (platform) => {
  const { config, read, extensions } = await fixture(platform)
  await build(config)
  expect((JSON.parse(await read('app.json')) as { pages: string[] }).pages).toEqual(['pages/home/index'])
  expect(await read('pages/home/index.js')).toContain('platform-host')
  expect(await read(`pages/home/index.${extensions.wxml}`)).toContain('{{message}}')
  expect(await read(`pages/home/index.${extensions.wxss}`)).toContain('red')
  const project = JSON.parse(await read(getProjectPlatformOptions(platform).projectConfigFileName)) as Record<string, unknown>
  expect(project[platform === 'swan' ? 'smartProgramRoot' : 'miniprogramRoot']).toBe('.')
}, 30_000)

it.each(getSupportedMiniProgramPlatforms())('updates native %s templates through classic host lifecycle', async (platform) => {
  const { root, config, read, extensions } = await fixture(platform)
  const server = await createServer(config)
  try {
    expect(await read(`pages/home/index.${extensions.wxml}`)).toContain('{{message}}')
    await writeFile(path.join(root, `src/pages/home/index.${extensions.wxml}`), '<view>updated platform</view>')
    await expect.poll(() => read(`pages/home/index.${extensions.wxml}`), { timeout: 15_000 }).toContain('updated platform')
  }
  finally {
    await server.close()
  }
}, 30_000)

async function directoryFixture() {
  const result = await fixture('weapp')
  result.config.weapp!.multiPlatform = true
  const configDir = path.join(result.root, 'config/weapp')
  await mkdir(configDir, { recursive: true })
  await writeFile(path.join(configDir, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist', appid: 'fixture-app' }))
  await writeFile(path.join(configDir, 'project.private.config.json'), JSON.stringify({ projectname: 'platform-fixture' }))
  return { ...result, configDir, readProject: (file: string) => readFile(path.join(result.root, 'dist/weapp', file), 'utf8') }
}

it('publishes directory metadata beside the application through native writes', async () => {
  const { config, read, readProject } = await directoryFixture()
  await build(config)
  expect((JSON.parse(await readProject('project.config.json')) as { miniprogramRoot: string }).miniprogramRoot).toBe('dist')
  expect((JSON.parse(await readProject('project.private.config.json')) as { projectname: string }).projectname).toBe('platform-fixture')
  expect(await read('app.js')).toContain('App')
})

it('updates and removes owned platform metadata during production watch', async () => {
  const { config, configDir, readProject } = await directoryFixture()
  const auxiliary = path.join(configDir, 'extra.json')
  await writeFile(auxiliary, '{"revision":1}')
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } }) as RolldownWatcher
  const errors: unknown[] = []
  watcher.on('event', event => event.code === 'ERROR' && errors.push(event.error))
  try {
    await expect.poll(() => readProject('extra.json'), { timeout: 15_000 }).toContain('1')
    await writeFile(auxiliary, '{"revision":2}')
    await expect.poll(() => readProject('extra.json'), { timeout: 15_000 }).toContain('2')
    await rm(auxiliary)
    await expect.poll(async () => readProject('extra.json').then(() => false, () => true), { timeout: 15_000 }).toBe(true)
    expect(errors).toEqual([])
  }
  finally { await watcher.close() }
}, 45_000)

it('rejects platform metadata that would overwrite compiled application files', async () => {
  const { config, configDir } = await directoryFixture()
  await mkdir(path.join(configDir, 'dist'), { recursive: true })
  await writeFile(path.join(configDir, 'dist/app.js'), 'invalid replacement')
  await expect(build(config)).rejects.toThrow('不能覆盖小程序输出')
})

it('publishes directory metadata when stateful dev uses an in-memory application snapshot', async () => {
  const { config, root, read, readProject } = await directoryFixture()
  config.weapp!.hmr = { runtime: 'stateful-experimental' }
  const server = await createServer(config)
  try {
    expect((JSON.parse(await readProject('project.config.json')) as { miniprogramRoot: string }).miniprogramRoot).toBe('dist')
    await writeFile(path.join(root, 'src/pages/home/index.wxml'), '<view>stateful platform</view>')
    await expect.poll(() => read('pages/home/index.wxml'), { timeout: 15_000 }).toContain('stateful platform')
  }
  finally {
    await server.close()
  }
}, 30_000)

it('returns inline platform metadata in memory without writing final outputs', async () => {
  const { config, read } = await fixture('alipay')
  config.build!.write = false
  const result = await build(config)
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('Expected one platform bundle')
  }
  expect(result.output.map(file => file.fileName)).toContain('mini.project.json')
  await expect(read('app.js')).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each([undefined, 'custom/application'])('uses the platform npm directory for Alipay native component assets with outDir %s', async (outDir) => {
  const { root, config, read } = await fixture('alipay')
  if (outDir) {
    config.build!.outDir = outDir
  }
  const readOutput = outDir ? (file: string) => readFile(path.join(root, outDir, file), 'utf8') : read
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'platform-consumer', type: 'module', dependencies: { 'mini-card': '1.0.0' } }))
  const pkg = path.join(root, 'node_modules/mini-card')
  await mkdir(path.join(pkg, 'miniprogram'), { recursive: true })
  await writeFile(path.join(pkg, 'package.json'), JSON.stringify({ name: 'mini-card', version: '1.0.0', main: 'miniprogram/index.js', miniprogram: 'miniprogram' }))
  for (const [extension, source] of Object.entries({ js: 'Component({})', json: '{"component":true}', wxml: '<view>npm platform</view>', wxss: 'view { color: green; }' })) {
    await writeFile(path.join(pkg, `miniprogram/index.${extension}`), source)
  }
  await build(config)
  expect(await readOutput('node_modules/mini-card/index.axml')).toContain('npm platform')
  expect((JSON.parse(await readOutput('node_modules/mini-card/index.json')) as { component: boolean }).component).toBe(true)
  expect((JSON.parse(await readOutput('mini.project.json')) as { miniprogramRoot: string }).miniprogramRoot).toBe('.')
})
