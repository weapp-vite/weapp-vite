import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
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
})
