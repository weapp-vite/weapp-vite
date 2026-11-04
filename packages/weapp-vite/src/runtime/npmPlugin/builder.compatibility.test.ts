import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createNpmOutput } from '../../vite/npm/output'
import { createPackageBuilder } from './builder'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createFixture(platform: 'weapp' | 'alipay' = 'weapp') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'npm-compatibility-')))
  roots.push(root)
  const write = async (file: string, source: string) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  await write('package.json', '{}')
  await write('node_modules/native-ui/package.json', JSON.stringify({ name: 'native-ui', version: '1.0.0', miniprogram: 'mini' }))
  await write('node_modules/utility/package.json', JSON.stringify({ name: 'utility', version: '1.0.0', main: 'index.js' }))
  await write('node_modules/utility/index.js', 'module.exports = "utility-root"')
  await write('node_modules/utility/deep.js', 'module.exports = "utility-deep"')
  const npmDir = platform === 'alipay' ? 'node_modules' : 'miniprogram_npm'
  const outDir = path.join(root, 'dist', npmDir)
  const buildOptions = vi.fn((options: NpmBuildOptions, _meta: { name: string }) => options)
  const ctx = {
    configService: { cwd: root, platform, weappViteConfig: { npm: { enable: true, buildOptions } } },
  } as unknown as MutableCompilerContext
  const capture = createNpmOutput(path.join(root, 'staging'), [outDir])
  const builder = createPackageBuilder(ctx, undefined, capture.output)
  const request = (dep: string, resolveFrom = root) => ({ dep, resolveFrom, outDir, isDependenciesCacheOutdate: true })
  const build = async () => {
    await builder.buildPackage(request('native-ui'))
    const result = await capture.finish(path.join(root, 'dist'), outDir, [])
    return new Map(result.assets.map(asset => [asset.fileName, String(asset.source)]))
  }
  return { root, write, ctx, npmDir, outDir, builder, capture, buildOptions, request, build }
}

it.each([
  ['weapp', 'miniprogram_npm'],
  ['alipay', 'miniprogram_npm'],
  ['alipay', 'node_modules'],
] as const)('retains %s native vendored subpaths in %s without their own package.json', async (platform, vendorDir) => {
  const { write, npmDir, build, buildOptions } = await createFixture(platform)
  await write('node_modules/native-ui/mini/common/use.js', 'module.exports = require("vendored/esm/detail")')
  await write(`node_modules/native-ui/mini/${vendorDir}/vendored/esm/detail.js`, 'module.exports = "vendored-detail"')
  const scripts = await build()
  expect(scripts.get(`${npmDir}/native-ui/common/use.js`)).toContain('vendored/esm/detail')
  expect(scripts.get(`${npmDir}/native-ui/${vendorDir}/vendored/esm/detail.js`)).toContain('vendored-detail')
  expect(buildOptions.mock.calls.map(([, meta]) => meta.name)).toEqual(['native-ui'])
})

it('does not treat an unsupported native npm directory as a published vendor resolution', async () => {
  const { write, build } = await createFixture('weapp')
  await write('node_modules/native-ui/mini/common/use.js', 'module.exports = require("vendored/esm/detail")')
  await write('node_modules/native-ui/mini/node_modules/vendored/esm/detail.js', 'module.exports = "unsupported-detail"')
  await expect(build()).rejects.toThrow('vendored/esm/detail')
})

it('scans retained vendored files for their own external subpath dependencies', async () => {
  const { write, build } = await createFixture()
  await write('node_modules/native-ui/mini/common/use.js', 'module.exports = require("vendored/esm/detail")')
  await write('node_modules/native-ui/mini/common/miniprogram_npm/vendored/esm/detail.js', 'module.exports = require("utility/deep")')
  const scripts = await build()
  expect(scripts.get('miniprogram_npm/native-ui/common/miniprogram_npm/vendored/esm/detail.js')).toContain('utility/deep')
  expect(scripts.get('miniprogram_npm/utility/deep.js')).toContain('utility-deep')
})

it('rejects a vendored subpath removed by the package copy policy', async () => {
  const { write, ctx, build } = await createFixture()
  await write('node_modules/native-ui/mini/common/use.js', 'module.exports = require("vendored/esm/detail")')
  await write('node_modules/native-ui/mini/miniprogram_npm/vendored/esm/detail.js', 'module.exports = "removed-detail"')
  ctx.configService!.weappViteConfig.npm!.packageFiles = { 'native-ui': { exclude: ['miniprogram_npm/**'] } }
  await expect(build()).rejects.toThrow('vendored/esm/detail')
})

it('coalesces builtin-package root and trailing-slash requests for the same physical package', async () => {
  const { write, builder, request, capture, root, outDir, buildOptions } = await createFixture()
  await write('node_modules/buffer/package.json', JSON.stringify({ name: 'buffer', version: '1.0.0', main: 'index.js' }))
  await write('node_modules/buffer/index.js', 'module.exports = "installed-buffer"')
  await builder.buildPackages(['buffer', 'buffer/'].map(dep => request(dep)))
  const result = await capture.finish(path.join(root, 'dist'), outDir, [])
  const scripts = result.assets.filter(asset => asset.fileName === 'miniprogram_npm/buffer/index.js')
  expect(scripts).toHaveLength(1)
  expect(String(scripts[0]!.source)).toContain('installed-buffer')
  expect(buildOptions.mock.calls.filter(([, meta]) => meta.name === 'buffer')).toHaveLength(1)
})

it('continues rejecting distinct physical package versions mapped to one logical output', async () => {
  const { write, builder, request } = await createFixture()
  for (const [owner, version] of [['native-ui', '1.0.0'], ['second-ui', '2.0.0']]) {
    await write(`node_modules/${owner}/package.json`, JSON.stringify({ name: owner, version: '1.0.0', miniprogram: 'mini', dependencies: { utility: '*' } }))
    await write(`node_modules/${owner}/mini/index.js`, 'module.exports = require("utility/deep")')
    await write(`node_modules/${owner}/node_modules/utility/package.json`, JSON.stringify({ name: 'utility', version, main: 'index.js' }))
    await write(`node_modules/${owner}/node_modules/utility/index.js`, `module.exports = ${JSON.stringify(version)}`)
    await write(`node_modules/${owner}/node_modules/utility/deep.js`, `module.exports = ${JSON.stringify(version)}`)
  }
  await expect(builder.buildPackages(['native-ui', 'second-ui'].map(dep => request(dep)))).rejects.toThrow('同一输出目录')
})

it.each([
  ['index.js', 'module.exports = require("utility/deep"); return'],
  ['index.cjs', 'module.exports = require("utility/deep"); return'],
  ['index.js', 'var legacy = 010; with ({ legacy }) { module.exports = require("utility/deep") }'],
])('preserves legal CommonJS syntax while scanning dependencies in %s: %s', async (file, source) => {
  const { write, build } = await createFixture()
  await write(`node_modules/native-ui/mini/${file}`, source)
  const scripts = await build()
  expect(scripts.get(`miniprogram_npm/native-ui/${file}`)).toBe(source)
  expect(scripts.get('miniprogram_npm/utility/deep.js')).toContain('utility-deep')
})

it('keeps static ESM subpath discovery in retained module files', async () => {
  const { write, build } = await createFixture()
  await write('node_modules/native-ui/mini/index.mjs', 'export { default } from "utility/deep"')
  const scripts = await build()
  expect(scripts.get('miniprogram_npm/utility/deep.js')).toContain('utility-deep')
})
