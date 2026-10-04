import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createBuilder, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(nested = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-plugin-project-'))
  roots.push(root)
  const pluginOutput = nested ? 'dist/plugin' : 'dist-plugin'
  const files = {
    'package.json': '{"name":"plugin-project-host","private":true,"type":"module"}',
    'project.config.json': JSON.stringify({ miniprogramRoot: 'dist/', pluginRoot: `${pluginOutput}/`, compileType: 'plugin' }),
    'vite.config.mjs': 'throw new Error("child must not reload config")',
    'src/app.ts': 'import { message } from "../shared/message"; App({ globalData: { message } })',
    'src/app.json': '{"pages":["pages/home/index"]}',
    'src/pages/home/index.ts': 'Page({})',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>plugin host</view>',
    'plugin/plugin.json': '{"main":"index.js","pages":{"hello":"pages/hello/index"}}',
    'plugin/index.ts': 'export { message } from "../shared/message"',
    'plugin/pages/hello/index.ts': 'Page({})',
    'plugin/pages/hello/index.json': '{}',
    'plugin/pages/hello/index.wxml': '<view>plugin page</view>',
    'shared/message.ts': 'export const message = "plugin original"',
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
    weapp: { srcRoot: 'src', pluginRoot: 'plugin', npm: { enable: false }, hmr: { runtime: 'classic' } },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  const read = () => readFile(path.join(root, pluginOutput, 'index.js'), 'utf8')
  const edit = (source: string) => writeFile(path.join(root, 'shared/message.ts'), source)
  return { root, config, read, edit, pluginOutput }
}

it.each([false, true])('builds app and plugin with one config and isolated output (nested=%s)', async (nested) => {
  const { root, config, read, pluginOutput } = await fixture(nested)
  config.plugins!.push({
    name: 'fixture:plugin-transform',
    transform(code, id) {
      if (id.endsWith('/shared/message.ts')) {
        return code.replace('plugin original', 'plugin transformed')
      }
    },
  })
  const builder = await createBuilder(config)
  await builder.buildApp()
  expect(await read()).toContain('plugin transformed')
  expect(Object.keys(builder.environments)).toContain('weapp_plugin')
  expect(await readFile(path.join(root, 'dist/app.json'), 'utf8')).toContain('pages/home/index')
  expect(await readFile(path.join(root, pluginOutput, 'plugin.json'), 'utf8')).toContain('pages/hello/index')
  expect(await readFile(path.join(root, pluginOutput, 'pages/hello/index.wxml'), 'utf8')).toContain('plugin page')
}, 30_000)

it('keeps the host build pending while visible plugin output is still publishing', async () => {
  const { config, read } = await fixture()
  const publication = Promise.withResolvers<void>()
  let publishing = false
  let outcome: { error?: unknown } | undefined
  config.plugins!.push({
    name: 'fixture:hold-plugin-publication',
    async writeBundle(_options, bundle) {
      if (bundle['plugin.json']) {
        publishing = true
        await publication.promise
      }
    },
  })
  const building = build(config).then(() => {
    outcome = {}
  }, (error: unknown) => {
    outcome = { error }
  })
  try {
    await expect.poll(() => publishing || Boolean(outcome), { timeout: 15_000 }).toBe(true)
    expect(await read()).toContain('plugin original')
    // 子目标已经落盘，父目标仍在等待 writeBundle 及后续依赖登记。
    expect(publishing).toBe(true)
    expect(outcome).toBeUndefined()
    publication.resolve()
    await building
    expect(outcome).toEqual({})
  }
  finally {
    publication.resolve()
    await building
  }
}, 30_000)

it('watches plugin dependencies and recovers without reloading user config', async () => {
  const { root, config, read, edit, pluginOutput } = await fixture()
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } }) as RolldownWatcher
  const errors: unknown[] = []
  const timeline: string[] = []
  let initialBuild: 'END' | 'ERROR' | undefined
  watcher.on('event', (event) => {
    timeline.push(event.code)
    if (event.code === 'ERROR') {
      errors.push(event.error)
    }
    if (event.code === 'END' || event.code === 'ERROR') {
      initialBuild ??= event.code
    }
  })
  try {
    // 普通依赖恢复在首轮监听就绪后验证；产物可读时 writeBundle 仍可能未完成。
    await expect.poll(() => initialBuild, { timeout: 15_000 }).toBeDefined()
    expect(errors).toEqual([])
    expect(initialBuild).toBe('END')
    await expect.poll(read, { timeout: 15_000 }).toContain('plugin original')
    await edit('export const message = ;')
    timeline.push('syntax error written')
    await expect.poll(() => errors.length, { timeout: 15_000 }).toBeGreaterThan(0)
    await edit('export const message = "plugin recovered"')
    timeline.push('recovery written')
    await expect.poll(read, { timeout: 15_000 }).toContain('plugin recovered')
    await writeFile(path.join(root, 'plugin/plugin.json'), '{"main":"index.js"}')
    await expect.poll(() => readFile(path.join(root, pluginOutput, 'pages/hello/index.js')).then(() => true, () => false), { timeout: 15_000 }).toBe(false)
  }
  catch (error) {
    throw new Error(`Plugin watch did not finish: ${timeline.join(' -> ')}`, { cause: error })
  }
  finally { await watcher.close() }
}, 30_000)

it.each([['classic', false], ['classic', true], ['stateful-experimental', false], ['stateful-experimental', true]] as const)('updates the isolated plugin target during %s with nested output=%s and closes its resources', async (runtime, nested) => {
  const { root, config, read, edit, pluginOutput } = await fixture(nested)
  config.weapp!.hmr = { runtime }
  const server = await createServer(config)
  try {
    expect(await read()).toContain('plugin original')
    expect(await readFile(path.join(root, pluginOutput, 'pages/hello/index.wxml'), 'utf8')).toContain('plugin page')
    await edit('export const message = "plugin updated"')
    await expect.poll(read, { timeout: 15_000 }).toContain('plugin updated')
    if (runtime === 'classic') {
      await expect.poll(() => readFile(path.join(root, 'dist/app.js'), 'utf8'), { timeout: 15_000 }).toContain('plugin updated')
    }
    expect(await readFile(path.join(root, pluginOutput, 'pages/hello/index.wxml'), 'utf8')).toContain('plugin page')
    await edit('export const message = "plugin restored"')
    await expect.poll(read, { timeout: 15_000 }).toContain('plugin restored')
    await writeFile(path.join(root, 'plugin/plugin.json'), '{"main":"index.js"}')
    await expect.poll(() => readFile(path.join(root, pluginOutput, 'pages/hello/index.wxml')).then(() => true, () => false), { timeout: 15_000 }).toBe(false)
    expect(await read()).toContain('plugin restored')
    expect(JSON.parse(await readFile(path.join(root, pluginOutput, 'plugin.json'), 'utf8'))).not.toHaveProperty('pages')
    await expect.poll(() => readFile(path.join(root, pluginOutput, 'pages/hello/index.js')).then(() => true, () => false), { timeout: 15_000 }).toBe(false)
    await writeFile(path.join(root, 'plugin/plugin.json'), '{"main":"index.js","pages":{"hello":"pages/hello/index"}}')
    await expect.poll(() => readFile(path.join(root, pluginOutput, 'pages/hello/index.wxml'), 'utf8'), { timeout: 15_000 }).toContain('plugin page')
  }
  finally { await server.close() }
}, 30_000)

it('rejects overlapping output ownership before writing either target', async () => {
  const { root, config } = await fixture()
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist/app/', pluginRoot: 'dist/', compileType: 'plugin' }))
  await expect(build(config)).rejects.toThrow('插件输出目录不能等于或包含宿主应用输出目录')
})

it('preserves explicit output retention for the plugin target', async () => {
  const { root, config, pluginOutput } = await fixture()
  config.build!.emptyOutDir = false
  await mkdir(path.join(root, pluginOutput), { recursive: true })
  await writeFile(path.join(root, pluginOutput, 'retained.txt'), 'keep')
  await build(config)
  expect(await readFile(path.join(root, pluginOutput, 'retained.txt'), 'utf8')).toBe('keep')
})

it('rejects memory-only dual output instead of silently omitting the plugin', async () => {
  const { root, config, pluginOutput } = await fixture()
  config.build!.write = false
  await expect(build(config)).rejects.toThrow('微信插件双产物暂不支持 build.write=false')
  await expect(readFile(path.join(root, pluginOutput, 'index.js'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each(['publication', 'restart'])('waits for active plugin %s when the host closes', async (phase) => {
  const { root, config, pluginOutput, read, edit } = await fixture()
  let builds = 0
  let armed = false
  let release!: () => void
  let entered!: () => void
  const blocked = new Promise<void>((resolve) => {
    entered = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  config.plugins!.push({
    name: 'fixture:slow-plugin-restart',
    async config(resolved) {
      if (phase === 'restart' && armed && String(resolved.build?.outDir).endsWith(pluginOutput)) {
        armed = false
        entered()
        await gate
      }
    },
    async generateBundle(_options, bundle) {
      if (bundle['plugin.json']) {
        builds++
        if (phase === 'publication' && armed) {
          armed = false
          entered()
          await gate
        }
      }
    },
  })
  const server = await createServer(config)
  try {
    await edit('export const message = "before close"')
    await expect.poll(read, { timeout: 5_000 }).toContain('before close')
    armed = true
    await writeFile(path.join(root, 'plugin/plugin.json'), '{"main":"index.js"}')
    await blocked
    let closed = false
    const closing = server.close().then(() => {
      closed = true
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(closed).toBe(false)
    release()
    await closing
    const buildsAtClose = builds
    await rm(path.join(root, pluginOutput), { recursive: true, force: true })
    await writeFile(path.join(root, 'shared/message.ts'), 'export const message = "after close"')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(builds).toBe(buildsAtClose)
    await expect(readFile(path.join(root, pluginOutput, 'index.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    release()
    await server.close()
  }
}, 15_000)
