import os from 'node:os'

import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  copyEsModuleDirectoryForAlipay,
  hoistNestedMiniprogramDependenciesForAlipay,
  normalizeMiniprogramPackageForAlipay,
  shouldRebuildCachedAlipayMiniprogramPackage,
} from './builder'

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-npm-builder-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe('runtime npm builder alipay adaptation', () => {
  it('normalizes miniprogram package files and converts js module format', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'tdesign-miniprogram')

    await fs.ensureDir(path.resolve(pkgRoot, 'button'))
    await fs.writeFile(path.resolve(pkgRoot, 'button/button.wxml'), '<view wx:if="{{ok}}"><wxs module="helper" src="./helper.wxs"/></view><import src="./cell.wxml" />')
    await fs.writeFile(path.resolve(pkgRoot, 'button/button.wxss'), '@import "./cell.wxss";')
    await fs.writeFile(path.resolve(pkgRoot, 'button/button.wxs'), 'module.exports = {}')
    await fs.writeFile(path.resolve(pkgRoot, 'button/helper.wxs'), 'module.exports = {}')
    await fs.writeFile(path.resolve(pkgRoot, 'button/dep.js'), 'module.exports = 1')
    await fs.writeFile(path.resolve(pkgRoot, 'button/button.js'), 'import dep from "./dep.js"; export default dep')
    await fs.writeFile(path.resolve(pkgRoot, 'button/button.json'), '{"usingComponents":{"x":"./x.wxml"}}')

    await normalizeMiniprogramPackageForAlipay(pkgRoot)

    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/button.wxml'))).toBe(false)
    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/button.wxss'))).toBe(false)
    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/button.wxs'))).toBe(false)
    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/button.axml'))).toBe(true)
    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/button.acss'))).toBe(true)
    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/button.sjs'))).toBe(true)
    expect(await fs.pathExists(path.resolve(pkgRoot, 'button/helper.sjs'))).toBe(true)

    const jsContent = await fs.readFile(path.resolve(pkgRoot, 'button/button.js'), 'utf8')
    const jsonContent = await fs.readFile(path.resolve(pkgRoot, 'button/button.json'), 'utf8')
    const axmlContent = await fs.readFile(path.resolve(pkgRoot, 'button/button.axml'), 'utf8')
    const acssContent = await fs.readFile(path.resolve(pkgRoot, 'button/button.acss'), 'utf8')

    expect(jsContent).toContain('require("./dep.js")')
    expect(jsContent).not.toContain('import dep from')
    expect(jsonContent).toContain('./x.axml')
    expect(axmlContent).toContain('./cell.axml')
    expect(axmlContent).toContain('a:if')
    expect(axmlContent).toContain('<import-sjs')
    expect(axmlContent).toContain('from="./helper.sjs"')
    expect(axmlContent).toContain('name="helper"')
    expect(acssContent).toContain('./cell.acss')
  })

  it('hoists nested miniprogram dependencies to output root', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'miniprogram_npm')
    const pkgRoot = path.resolve(outDir, 'tdesign-miniprogram')

    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram_npm/tslib'))
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram_npm/tslib/index.js'), 'module.exports = {}')

    await hoistNestedMiniprogramDependenciesForAlipay(pkgRoot, outDir)

    expect(await fs.pathExists(path.resolve(outDir, 'tslib/index.js'))).toBe(true)
  })

  it('copies es directory for alipay node_modules mode compatibility', async () => {
    const root = await createTempDir()
    const sourceRoot = path.resolve(root, 'antd-mini')
    const targetRoot = path.resolve(root, 'out/antd-mini')

    await fs.ensureDir(path.resolve(sourceRoot, 'es/Button'))
    await fs.writeFile(path.resolve(sourceRoot, 'es/Button/index.axml'), '<import-sjs from="./index.sjs" name="helper" />')

    const copied = await copyEsModuleDirectoryForAlipay(sourceRoot, targetRoot)

    expect(copied).toBe(true)
    expect(await fs.pathExists(path.resolve(targetRoot, 'es/Button/index.axml'))).toBe(true)
  })

  it('rebuilds cached package when source has es but target is missing it', async () => {
    const root = await createTempDir()
    const sourceRoot = path.resolve(root, 'source/antd-mini')
    const outDir = path.resolve(root, 'out/node_modules')
    const pkgRoot = path.resolve(outDir, 'antd-mini')

    await fs.ensureDir(path.resolve(sourceRoot, 'es/Button'))
    await fs.writeFile(path.resolve(sourceRoot, 'es/Button/index.axml'), '<view />')

    await fs.ensureDir(path.resolve(pkgRoot, 'Button'))
    await fs.writeFile(path.resolve(pkgRoot, 'Button/index.axml'), '<view />')

    const shouldRebuild = await shouldRebuildCachedAlipayMiniprogramPackage(
      pkgRoot,
      outDir,
      sourceRoot,
      'node_modules',
    )

    expect(shouldRebuild).toBe(true)
  })

  it('returns true when cached package root does not exist', async () => {
    const root = await createTempDir()
    const shouldRebuild = await shouldRebuildCachedAlipayMiniprogramPackage(
      path.resolve(root, 'missing'),
      path.resolve(root, 'out'),
    )

    expect(shouldRebuild).toBe(true)
  })

  it('detects incompatible cached syntax in wxml/js/axml files', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'out/miniprogram_npm')

    const wxmlPkg = path.resolve(root, 'wxml-pkg')
    await fs.ensureDir(wxmlPkg)
    await fs.writeFile(path.resolve(wxmlPkg, 'index.wxml'), '<view />')
    expect(await shouldRebuildCachedAlipayMiniprogramPackage(wxmlPkg, outDir)).toBe(true)

    const jsPkg = path.resolve(root, 'js-pkg')
    await fs.ensureDir(jsPkg)
    await fs.writeFile(path.resolve(jsPkg, 'index.js'), 'const value = left ?? right')
    expect(await shouldRebuildCachedAlipayMiniprogramPackage(jsPkg, outDir)).toBe(true)

    const axmlPkg = path.resolve(root, 'axml-pkg')
    await fs.ensureDir(axmlPkg)
    await fs.writeFile(path.resolve(axmlPkg, 'index.axml'), '<view wx:if="{{ok}}" else></view>')
    expect(await shouldRebuildCachedAlipayMiniprogramPackage(axmlPkg, outDir)).toBe(true)
  })

  it('validates nested dependency cache existence when syntax is already compatible', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'valid-pkg')
    const outDir = path.resolve(root, 'out/miniprogram_npm')
    await fs.ensureDir(path.resolve(pkgRoot, 'sub'))
    await fs.writeFile(path.resolve(pkgRoot, 'sub/index.js'), 'module.exports = 1')

    expect(await shouldRebuildCachedAlipayMiniprogramPackage(pkgRoot, outDir)).toBe(false)

    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram_npm/tslib'))
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram_npm/tslib/index.js'), 'module.exports = 1')
    expect(await shouldRebuildCachedAlipayMiniprogramPackage(pkgRoot, outDir)).toBe(true)

    await fs.ensureDir(path.resolve(outDir, 'tslib'))
    await fs.writeFile(path.resolve(outDir, 'tslib/index.js'), 'module.exports = 1')
    expect(await shouldRebuildCachedAlipayMiniprogramPackage(pkgRoot, outDir)).toBe(false)
  })

  it('converts multiple esm export/import forms and keeps invalid source stable', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'complex-pkg')
    await fs.ensureDir(pkgRoot)

    await fs.writeFile(path.resolve(pkgRoot, 'side.js'), 'module.exports = {}')
    await fs.writeFile(path.resolve(pkgRoot, 'dep.js'), 'exports.foo = 1; exports.bar = 2')
    await fs.writeFile(path.resolve(pkgRoot, 'main.js'), [
      'import "./side.js"',
      'import * as ns from "./dep.js"',
      'import { foo as renamed } from "./dep.js"',
      'export default function () { return ns.bar + renamed }',
      'export const local = renamed',
      'export { renamed as alias }',
      'export { foo as forwarded } from "./dep.js"',
      'export {}',
    ].join('\n'))
    await fs.writeFile(path.resolve(pkgRoot, 'klass.js'), 'export default class {}')
    await fs.writeFile(path.resolve(pkgRoot, 'noop.js'), 'const marker = "import value"; module.exports = marker')
    await fs.writeFile(path.resolve(pkgRoot, 'broken.js'), 'import {')

    await normalizeMiniprogramPackageForAlipay(pkgRoot)

    const main = await fs.readFile(path.resolve(pkgRoot, 'main.js'), 'utf8')
    const klass = await fs.readFile(path.resolve(pkgRoot, 'klass.js'), 'utf8')
    const noop = await fs.readFile(path.resolve(pkgRoot, 'noop.js'), 'utf8')
    const broken = await fs.readFile(path.resolve(pkgRoot, 'broken.js'), 'utf8')

    expect(main).toContain('__esModule')
    expect(main).toContain('require("./side.js")')
    expect(main).toContain('const _imported = require("./dep.js")')
    expect(main).toContain('exports["default"]')
    expect(main).toContain('exports.local')
    expect(main).toContain('exports.alias')
    expect(main).toContain('exports.forwarded')
    expect(klass).toContain('exports["default"]')
    expect(noop).toContain('"import value"')
    expect(broken).toBe('import {')
  })

  it('keeps unsupported export namespace re-exports stable while still converting surrounding esm syntax', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'namespace-pkg')
    await fs.ensureDir(pkgRoot)

    await fs.writeFile(path.resolve(pkgRoot, 'dep.js'), 'exports.foo = 1')
    await fs.writeFile(path.resolve(pkgRoot, 'main.js'), [
      'import dep from "./dep.js"',
      'export * as namespaceAlias from "./dep.js"',
      'export default dep',
    ].join('\n'))

    await normalizeMiniprogramPackageForAlipay(pkgRoot)

    const main = await fs.readFile(path.resolve(pkgRoot, 'main.js'), 'utf8')
    expect(main).toContain('__esModule')
    expect(main).toContain('const _imported = require("./dep.js")')
    expect(main).toContain('const _reExported = require("./dep.js")')
    expect(main).not.toContain('exports.namespaceAlias')
    expect(main).toContain('exports["default"]')
  })

  it('keeps hoist/copy helpers no-op when source is missing or target already exists', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'pkg')
    const outDir = path.resolve(root, 'out/miniprogram_npm')

    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram_npm/dep-a'))
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram_npm/dep-a/index.js'), 'module.exports = 1')
    await fs.ensureDir(path.resolve(outDir, 'dep-a'))
    await fs.writeFile(path.resolve(outDir, 'dep-a/index.js'), 'module.exports = 2')

    await hoistNestedMiniprogramDependenciesForAlipay(pkgRoot, outDir)
    expect(await fs.readFile(path.resolve(outDir, 'dep-a/index.js'), 'utf8')).toBe('module.exports = 2')

    await hoistNestedMiniprogramDependenciesForAlipay(path.resolve(root, 'pkg-no-nested'), outDir)

    const copied = await copyEsModuleDirectoryForAlipay(path.resolve(root, 'source-no-es'), path.resolve(root, 'target'))
    expect(copied).toBe(false)
  })

  it('treats json template references as stale cache and skips unreadable or non-text files during detection', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'out/miniprogram_npm')

    const staleJsonPkg = path.resolve(root, 'json-pkg')
    await fs.ensureDir(staleJsonPkg)
    await fs.writeFile(path.resolve(staleJsonPkg, 'index.json'), '{"template":"./entry.wxml"}')
    expect(await shouldRebuildCachedAlipayMiniprogramPackage(staleJsonPkg, outDir)).toBe(true)

    const assetPkg = path.resolve(root, 'asset-pkg')
    await fs.ensureDir(assetPkg)
    const unreadablePath = path.resolve(assetPkg, 'broken.axml')
    await fs.writeFile(unreadablePath, '<view />')
    await fs.writeFile(path.resolve(assetPkg, 'image.png'), 'binary')
    await fs.writeFile(path.resolve(assetPkg, 'index.js'), 'module.exports = 1')

    const originalReadFile = fs.readFile.bind(fs)
    const readFileSpy = vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: any, ...args: any[]) => {
      if (filePath === unreadablePath) {
        throw new Error('mock read failure')
      }
      return originalReadFile(filePath, ...args)
    })

    await expect(shouldRebuildCachedAlipayMiniprogramPackage(assetPkg, outDir)).resolves.toBe(false)

    readFileSpy.mockRestore()
  })

  it('keeps normalize helper as a no-op for missing roots and non-text assets', async () => {
    const root = await createTempDir()

    await expect(normalizeMiniprogramPackageForAlipay(path.resolve(root, 'missing'))).resolves.toBeUndefined()

    const pkgRoot = path.resolve(root, 'asset-only-pkg')
    await fs.ensureDir(pkgRoot)
    await fs.writeFile(path.resolve(pkgRoot, 'icon.png'), 'binary')
    await fs.writeFile(path.resolve(pkgRoot, 'style.acss'), '@import "./base.acss";')

    await normalizeMiniprogramPackageForAlipay(pkgRoot)

    expect(await fs.readFile(path.resolve(pkgRoot, 'icon.png'), 'utf8')).toBe('binary')
    expect(await fs.readFile(path.resolve(pkgRoot, 'style.acss'), 'utf8')).toBe('@import "./base.acss";')
  })
})
