import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import { mkdir, mkdtemp, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createNpmOutput } from '../../vite/npm/output'
import { createPackageBuilder } from './builder'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createFixture(platform: 'weapp' | 'alipay' = 'alipay') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'npm-subpath-')))
  roots.push(root)
  const write = async (file: string, source: string) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  await write('package.json', JSON.stringify({ dependencies: { 'mini-package': '*' } }))
  await write('node_modules/mini-package/package.json', JSON.stringify({ name: 'mini-package', version: '1.0.0', miniprogram: 'mini', dependencies: { utility: '*' } }))
  await write('node_modules/mini-package/mini/index.js', 'module.exports = require("utility/plugin/duration")')
  await write('node_modules/utility/package.json', JSON.stringify({ name: 'utility', version: '1.0.0', main: 'index.js' }))
  await write('node_modules/utility/index.js', 'module.exports = "ordinary-root"')
  await write('node_modules/utility/plugin/duration.js', 'module.exports = "duration-plugin"')
  const npmDir = platform === 'alipay' ? 'node_modules' : 'miniprogram_npm'
  const outDir = path.join(root, 'dist', npmDir)
  const buildOptions = vi.fn((options: NpmBuildOptions, _meta: { name: string }) => options)
  const ctx = {
    configService: { cwd: root, platform, weappViteConfig: { npm: { enable: true, buildOptions } } },
  } as unknown as MutableCompilerContext
  return { root, write, outDir, npmDir, ctx, buildOptions }
}

it.each(['weapp', 'alipay'] as const)('publishes copied %s components together with their ordinary dependency subpaths', async (platform) => {
  const { root, outDir, npmDir, ctx } = await createFixture(platform)
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  await builder.buildPackage({ dep: 'mini-package', resolveFrom: root, outDir, isDependenciesCacheOutdate: true })
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  const scripts = new Map(result.assets.map(asset => [asset.fileName, String(asset.source)]))
  expect(scripts.get(`${npmDir}/mini-package/index.js`)).toContain('utility/plugin/duration')
  expect(scripts.get(`${npmDir}/utility/index.js`)).toContain('ordinary-root')
  expect(scripts.get(`${npmDir}/utility/plugin/duration.js`)).toContain('duration-plugin')
})

it('merges subpath requests from separate copied packages into one ordinary package build', async () => {
  const { root, write, outDir, ctx, buildOptions } = await createFixture()
  await write('node_modules/second-package/package.json', JSON.stringify({ name: 'second-package', version: '1.0.0', miniprogram: 'mini', dependencies: { utility: '*' } }))
  await write('node_modules/second-package/mini/index.js', 'module.exports = require("utility/plugin/second")')
  await write('node_modules/utility/plugin/second.js', 'module.exports = "second-plugin"')
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  await builder.buildPackages(['mini-package', 'second-package', 'utility'].map(dep => ({ dep, resolveFrom: root, outDir, isDependenciesCacheOutdate: true })))
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  const scripts = new Map(result.assets.map(asset => [asset.fileName, String(asset.source)]))
  expect(scripts.get('node_modules/utility/plugin/duration.js')).toContain('duration-plugin')
  expect(scripts.get('node_modules/utility/plugin/second.js')).toContain('second-plugin')
  const calls = buildOptions.mock.calls.filter(([, meta]) => meta.name === 'utility')
  expect(calls).toHaveLength(1)
  const input = (file: string) => path.join(root, 'node_modules/utility', file)
  const lib = calls[0]![0].build?.lib
  const entries = lib && lib.entry
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('Expected named npm package entries')
  }
  expect(Object.fromEntries(Object.entries(entries).map(([name, file]) => [name, path.normalize(file)]))).toMatchObject({
    'index': input('index.js'),
    'plugin/duration': input('plugin/duration.js'),
    'plugin/second': input('plugin/second.js'),
  })
})

it('repairs an index-only dependency cache and invalidates it when a required subpath source changes', async () => {
  const { root, write, outDir, ctx } = await createFixture()
  await write('dist/node_modules/mini-package/index.js', 'module.exports = require("utility/plugin/duration")')
  await write('dist/node_modules/utility/index.js', 'module.exports = "old-root"')
  const builder = createPackageBuilder(ctx)
  const request = { dep: 'mini-package', resolveFrom: root, outDir, isDependenciesCacheOutdate: false }
  await builder.buildPackage(request)
  const plugin = path.join(outDir, 'utility/plugin/duration.js')
  expect(await readFile(plugin, 'utf8')).toContain('duration-plugin')
  await write('node_modules/utility/plugin/duration.js', 'module.exports = "updated-plugin"')
  await utimes(plugin, 1, 1)
  await builder.buildPackage(request)
  expect(await readFile(plugin, 'utf8')).toContain('updated-plugin')
})

it('keeps the requested public subpath when package exports resolve to a different physical file', async () => {
  const { root, write, outDir, ctx } = await createFixture()
  await write('node_modules/mini-package/mini/index.js', 'module.exports = require("utility/public")')
  await write('node_modules/utility/package.json', JSON.stringify({ name: 'utility', version: '1.0.0', main: 'index.js', exports: { '.': './index.js', './public': './internal/entry.js' } }))
  await write('node_modules/utility/internal/entry.js', 'module.exports = "public-subpath"')
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  await builder.buildPackage({ dep: 'mini-package', resolveFrom: root, outDir, isDependenciesCacheOutdate: true })
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  const scripts = new Map(result.assets.map(asset => [asset.fileName, String(asset.source)]))
  expect(scripts.get('node_modules/utility/public.js')).toContain('public-subpath')
})

it('ignores locally bound require calls while keeping the global component dependency', async () => {
  const { root, write, outDir, ctx } = await createFixture()
  await write('node_modules/mini-package/mini/index.js', [
    'function local(require) { return require("utility/plugin/shadowed") }',
    'module.exports = { local, plugin: require("utility/plugin/duration") }',
  ].join('\n'))
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  await builder.buildPackage({ dep: 'mini-package', resolveFrom: root, outDir, isDependenciesCacheOutdate: true })
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  expect(result.assets.map(asset => asset.fileName)).toContain('node_modules/utility/plugin/duration.js')
  expect(result.assets.map(asset => asset.fileName)).not.toContain('node_modules/utility/plugin/shadowed.js')
})

it('collects subpaths from the component files retained by the package copy policy', async () => {
  const { root, write, outDir, ctx } = await createFixture()
  await write('node_modules/mini-package/mini/unused.js', 'require("utility/plugin/excluded")')
  ctx.configService!.weappViteConfig.npm!.packageFiles = { 'mini-package': { exclude: ['unused.js'] } }
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  await builder.buildPackage({ dep: 'mini-package', resolveFrom: root, outDir, isDependenciesCacheOutdate: true })
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  expect(result.assets.map(asset => asset.fileName)).toContain('node_modules/utility/plugin/duration.js')
  expect(result.assets.map(asset => asset.fileName)).not.toContain('node_modules/mini-package/unused.js')
  expect(result.assets.map(asset => asset.fileName)).not.toContain('node_modules/utility/plugin/excluded.js')
})

it.each([
  ['utility/data.json', 'data.json'],
  ['utility/public-data', 'public-data.json'],
])('preserves JSON bytes and the requested path for %s', async (request, emittedPath) => {
  const { root, write, outDir, ctx } = await createFixture()
  const source = '{"duration": 42}\n'
  await write('node_modules/mini-package/mini/index.js', `module.exports = require(${JSON.stringify(request)})`)
  await write('node_modules/utility/package.json', JSON.stringify({ name: 'utility', version: '1.0.0', main: 'index.js', exports: { '.': './index.js', './public-data': './data.json', './data.json': './data.json' } }))
  await write('node_modules/utility/data.json', source)
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  await builder.buildPackage({ dep: 'mini-package', resolveFrom: root, outDir, isDependenciesCacheOutdate: true })
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  const asset = result.assets.find(asset => asset.fileName === `node_modules/utility/${emittedPath}`)
  expect(asset).toBeDefined()
  expect(String(asset!.source)).toBe(source)
})
