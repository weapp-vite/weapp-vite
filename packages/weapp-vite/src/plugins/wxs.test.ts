import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 测试临时目录清理沿用现有 fs-extra 用法
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { wxs } from './wxs'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe('wxs plugin', () => {
  it('emits wxs assets from tokenMap in generateBundle hook', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/coupon-card')
    await fs.ensureDir(componentDir)

    const vueFile = path.join(componentDir, 'index.vue')
    const wxsFile = path.join(componentDir, 'tools.wxs')
    await fs.writeFile(vueFile, '<template><view /></template>', 'utf8')
    await fs.writeFile(wxsFile, 'module.exports = { noop: function() {} }', 'utf8')

    const tokenMap = new Map([
      [
        vueFile,
        {
          deps: [
            {
              name: 'src',
              value: './tools.wxs',
              quote: '"',
              tagName: 'wxs',
              start: 0,
              end: 0,
              attrs: {
                src: './tools.wxs',
              },
            },
          ],
        },
      ],
    ])

    const plugin = wxs({
      configService: {
        absoluteSrcRoot: srcRoot,
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
        relativeOutputPath(filePath: string) {
          return path.relative(srcRoot, filePath).replace(/\\/g, '/')
        },
      },
      wxmlService: {
        tokenMap,
      },
    } as any)[0]

    const emitFile = vi.fn()
    const addWatchFile = vi.fn()

    plugin.buildStart?.call({} as any)
    await plugin.generateBundle?.call(
      {
        emitFile,
        addWatchFile,
      } as any,
      {},
      {},
    )

    expect(emitFile).toHaveBeenCalledTimes(1)
    const emitted = emitFile.mock.calls[0][0]
    expect(emitted.fileName).toBe('components/coupon-card/tools.wxs')
    expect(typeof emitted.source).toBe('string')
    expect(emitted.source.length).toBeGreaterThan(0)
  })

  it('emits wxs assets by scanning generated wxml bundle assets', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-bundle-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/swipeout')
    await fs.ensureDir(componentDir)

    const wxsFile = path.join(componentDir, 'swipe.wxs')
    await fs.writeFile(wxsFile, 'module.exports = { startDrag: function() {} }', 'utf8')

    const plugin = wxs({
      configService: {
        absoluteSrcRoot: srcRoot,
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
        relativeOutputPath(filePath: string) {
          return path.relative(srcRoot, filePath).replace(/\\/g, '/')
        },
      },
      wxmlService: {
        tokenMap: new Map(),
      },
    } as any)[0]

    const emitFile = vi.fn()
    const addWatchFile = vi.fn()

    plugin.buildStart?.call({} as any)
    await plugin.generateBundle?.call(
      {
        emitFile,
        addWatchFile,
      } as any,
      {},
      {
        'components/swipeout/index.wxml': {
          type: 'asset',
          source: '<wxs src="./swipe.wxs" module="swipe" /><view />',
        },
      },
    )

    expect(emitFile).toHaveBeenCalledTimes(1)
    const emitted = emitFile.mock.calls[0][0]
    expect(emitted.fileName).toBe('components/swipeout/swipe.wxs')
    expect(typeof emitted.source).toBe('string')
    expect(emitted.source.length).toBeGreaterThan(0)
  })

  it('emits script module assets for import-sjs deps collected from tokenMap', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-import-sjs-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/pay-card')
    await fs.ensureDir(componentDir)

    const vueFile = path.join(componentDir, 'index.vue')
    const sjsFile = path.join(componentDir, 'helper.sjs')
    await fs.writeFile(vueFile, '<template><view /></template>', 'utf8')
    await fs.writeFile(sjsFile, 'module.exports = { noop: function() {} }', 'utf8')

    const tokenMap = new Map([
      [
        vueFile,
        {
          deps: [
            {
              name: 'from',
              value: './helper.sjs',
              quote: '"',
              tagName: 'import-sjs',
              start: 0,
              end: 0,
              attrs: {
                from: './helper.sjs',
                name: 'helper',
              },
            },
          ],
        },
      ],
    ])

    const plugin = wxs({
      configService: {
        absoluteSrcRoot: srcRoot,
        platform: 'alipay',
        outputExtensions: {
          wxml: 'axml',
          wxs: 'sjs',
        },
        relativeOutputPath(filePath: string) {
          return path.relative(srcRoot, filePath).replace(/\\/g, '/')
        },
      },
      wxmlService: {
        tokenMap,
      },
    } as any)[0]

    const emitFile = vi.fn()
    const addWatchFile = vi.fn()

    plugin.buildStart?.call({} as any)
    await plugin.generateBundle?.call(
      {
        emitFile,
        addWatchFile,
      } as any,
      {},
      {},
    )

    expect(emitFile).toHaveBeenCalledTimes(1)
    const emitted = emitFile.mock.calls[0][0]
    expect(emitted.fileName).toBe('components/pay-card/helper.sjs')
    expect(typeof emitted.source).toBe('string')
    expect(emitted.source.length).toBeGreaterThan(0)
  })
})
