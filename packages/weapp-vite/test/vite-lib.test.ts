import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import { cp, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { build, createServer, resolveConfig } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { weapp } from '../src/vite'
import { WeappBuildSession } from '../src/vite/session'

const roots: string[] = []
const fixtureRoot = path.resolve(import.meta.dirname, '../../../test/fixture-projects/weapp-vite/lib-mode')
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-host-'))
  roots.push(root)
  for (const file of ['src', 'package.json', 'tsconfig.json']) {
    await cp(path.join(fixtureRoot, file), path.join(root, file), { recursive: true })
  }
  await symlink(path.join(fixtureRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction')
  await writeFile(path.join(root, 'vite.config.mjs'), 'throw new Error("lib must not reload config")')
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    weapp: {
      srcRoot: 'src',
      lib: {
        entry: {
          'components/button/index': 'components/button/index.ts',
          'components/sfc-setup/index': 'components/sfc-setup/index.vue',
          'utils/index': 'utils/index.ts',
        },
        root: 'src',
        componentJson: 'auto',
      },
      hmr: { runtime: 'classic' },
    },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  const read = (file: string) => readFile(path.join(root, 'dist', file), 'utf8')
  return { root, config, read }
}

it('builds native and Vue component libraries with declarations in the host bundle', async () => {
  const { config, read } = await fixture()
  const result = await build(config)
  expect(Array.isArray(result)).toBe(false)
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('expected one library bundle')
  }
  const files = result.output.map(file => file.fileName)
  expect(files).toEqual(expect.arrayContaining(['components/button/index.js', 'components/button/index.wxml', 'components/button/index.wxss', 'components/button/index.json', 'components/button/index.d.ts', 'components/sfc-setup/index.d.ts', 'utils/index.d.ts']))
  expect(files).not.toContain('app.json')
  expect(JSON.parse(await read('components/button/index.json')).component).toBe(true)
  expect(await read('components/button/index.d.ts')).toContain('declare function useLabel')
  expect(await read('components/sfc-setup/index.d.ts')).not.toContain('declare const _default: any')
}, 60_000)

it('keeps declarations in memory for build.write=false and honors entry renaming', async () => {
  const { config, read } = await fixture()
  config.weapp!.lib = { entry: { button: 'components/button/index.ts' }, root: 'src', fileName: 'widgets/[name]' }
  config.build!.write = false
  const result = await build(config)
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('expected one library bundle')
  }
  expect(result.output.map(file => file.fileName)).toEqual(expect.arrayContaining(['widgets/button.js', 'widgets/button.json', 'widgets/button.wxml', 'widgets/button.d.ts']))
  await expect(read('widgets/button.d.ts')).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(read('widgets/button.js')).rejects.toMatchObject({ code: 'ENOENT' })
}, 30_000)

it('keeps type-only edits during the first publication and recovers declarations in production watch', async () => {
  const { root, config, read } = await fixture()
  config.weapp!.lib = { entry: { utils: 'utils/index.ts' }, root: 'src' }
  const types = path.join(root, 'src/utils/types.ts')
  await writeFile(types, 'export interface PublicValue { initial: string }')
  await writeFile(path.join(root, 'src/utils/index.ts'), 'export type { PublicValue } from "./types"; export const value = 1')
  const publication = Promise.withResolvers<void>()
  const publishing = Promise.withResolvers<void>()
  let firstPublication = true
  const started = performance.now()
  const timeline: { phase: string, elapsed: number, watchesTypes?: boolean }[] = []
  const record = (phase: string, watchesTypes?: boolean) => {
    timeline.push({ phase, elapsed: Math.round(performance.now() - started), watchesTypes })
  }
  const canonicalTypes = await realpath(types)
  config.plugins!.push({
    name: 'test:lib-dts-watch-timeline',
    buildStart() { record('buildStart') },
    watchChange(id) { record('watchChange', id === canonicalTypes || id === types) },
    generateBundle: {
      order: 'post',
      handler() { record('generateBundle') },
    },
    async writeBundle() {
      record('writeBundle')
      if (firstPublication) {
        firstPublication = false
        publishing.resolve()
        await publication.promise
      }
    },
  })
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } }) as RolldownWatcher
  const errors: unknown[] = []
  watcher.on('event', (event) => {
    record(event.code)
    if (event.code === 'ERROR') {
      errors.push(event.error)
    }
  })
  try {
    await expect.poll(() => read('utils.d.ts'), { timeout: 20_000 }).toContain('initial: string')
    record('initial declaration observed')
    await publishing.promise
    await writeFile(types, 'export interface PublicValue { updated: number }')
    record('type dependency edited')
    publication.resolve()
    await expect.poll(() => read('utils.d.ts'), { timeout: 20_000 }).toContain('updated: number')
    expect(errors).toEqual([])
    await writeFile(types, 'export interface PublicValue { broken: }')
    await expect.poll(() => errors.length, { timeout: 20_000 }).toBeGreaterThan(0)
    await writeFile(types, 'export interface PublicValue { recovered: boolean }')
    await expect.poll(() => read('utils.d.ts'), { timeout: 20_000 }).toContain('recovered: boolean')
  }
  catch (error) {
    // 仅在失败时输出生命周期，不增加等待、重试或改变原始保存与断言顺序。
    process.stderr.write(`[lib-dts-watch-timeline] ${JSON.stringify({ timeline, errors: errors.map(error => String(error).replaceAll(root, '<fixture>').replaceAll(path.resolve('.'), '<workspace>')) })}\n`)
    throw error
  }
  finally { await watcher.close() }
  
}, 80_000)

it('updates library templates in classic dev without an application entry', async () => {
  const { root, config, read } = await fixture()
  config.weapp!.lib = { entry: { button: 'components/button/index.ts' }, root: 'src', dts: false }
  const server = await createServer(config)
  try {
    expect(await read('button.wxml')).toContain('{{label}}')
    await writeFile(path.join(root, 'src/components/button/index.wxml'), '<view>updated library</view>')
    await expect.poll(() => read('button.wxml'), { timeout: 15_000 }).toContain('updated library')
    await expect(read('app.json')).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally { await server.close() }
}, 30_000)

it('builds declarations when the project root is a directory alias', async () => {
  const { root, config, read } = await fixture()
  const aliases = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-alias-'))
  roots.push(aliases)
  const alias = path.join(await realpath(aliases), 'project')
  await symlink(root, alias, 'junction')
  config.root = alias
  config.weapp!.lib = { entry: { utils: 'utils/index.ts' }, root: 'src' }
  const result = await build(config)
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('expected one library bundle')
  }
  expect(result.output.map(file => file.fileName)).toContain('utils.d.ts')
  expect(await read('utils.d.ts')).toContain('export')
}, 30_000)

it.each([false, true])('updates library templates through an aliased root with preserveSymlinks=%s', async (preserveSymlinks) => {
  const { root, config, read } = await fixture()
  const aliases = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-dev-alias-'))
  roots.push(aliases)
  const alias = path.join(await realpath(aliases), 'project')
  await symlink(root, alias, 'junction')
  config.root = alias
  config.resolve = { preserveSymlinks }
  config.weapp!.lib = { entry: { button: 'components/button/index.ts' }, root: 'src', dts: false }
  const server = await createServer(config)
  try {
    expect(await read('button.wxml')).toContain('{{label}}')
    await writeFile(path.join(alias, 'src/components/button/index.wxml'), '<view>updated through alias</view>')
    await expect.poll(() => read('button.wxml'), { timeout: 15_000 }).toContain('updated through alias')
  }
  finally { await server.close() }
}, 30_000)

it.each([false, true])('shares the host root identity with compiler sidecars for preserveSymlinks=%s', async (preserveSymlinks) => {
  const { root, config } = await fixture()
  const aliases = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-session-alias-'))
  roots.push(aliases)
  const alias = path.join(await realpath(aliases), 'project')
  await symlink(root, alias, 'junction')
  config.root = alias
  config.resolve = { preserveSymlinks }
  config.plugins = []
  config.weapp!.lib = { entry: { button: 'components/button/index.ts' }, root: 'src', dts: false }
  const host = await resolveConfig(config, 'serve')
  const session = new WeappBuildSession()
  try {
    await session.prepare(config, alias, 'development', true)
    expect(session.context.configService.cwd).toBe(host.root)
  }
  finally { await session.close() }
})
