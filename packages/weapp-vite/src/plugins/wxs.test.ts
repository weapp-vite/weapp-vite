import os from 'node:os'
import path from 'node:path'

import { fs } from '@weapp-core/shared/fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { wxs } from './wxs'

const tempDirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
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

  it('reuses unchanged wxs file transforms across generateBundle passes', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-cache-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/cache-card')
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
    const readFileSpy = vi.spyOn(fs, 'readFile')

    plugin.buildStart?.call({} as any)
    await plugin.generateBundle?.call(
      {
        emitFile,
        addWatchFile,
      } as any,
      {},
      {},
    )
    await plugin.generateBundle?.call(
      {
        emitFile,
        addWatchFile,
      } as any,
      {},
      {},
    )

    const wxsReadCount = readFileSpy.mock.calls.filter(([filePath]) => filePath === wxsFile).length
    expect(wxsReadCount).toBe(1)
    expect(emitFile).toHaveBeenCalledTimes(2)
    expect(emitFile.mock.calls[1][0].fileName).toBe('components/cache-card/tools.wxs')
  })

  it('skips full tokenMap scans during unrelated script hmr', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-script-hmr-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/skip-card')
    await fs.ensureDir(componentDir)

    const vueFile = path.join(componentDir, 'index.vue')
    const wxsFile = path.join(componentDir, 'tools.wxs')
    const scriptFile = path.join(srcRoot, 'pages/index/index.ts')
    await fs.ensureDir(path.dirname(scriptFile))
    await fs.writeFile(vueFile, '<template><view /></template>', 'utf8')
    await fs.writeFile(wxsFile, 'module.exports = { noop: function() {} }', 'utf8')
    await fs.writeFile(scriptFile, 'Page({})', 'utf8')

    const ctx = {
      configService: {
        absoluteSrcRoot: srcRoot,
        isDev: true,
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
        relativeOutputPath(filePath: string) {
          return path.relative(srcRoot, filePath).replace(/\\/g, '/')
        },
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {
              event: 'update',
              file: scriptFile,
            },
          },
        },
      },
      wxmlService: {
        tokenMap: new Map([
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
        ]),
      },
    } as any
    const plugin = wxs(ctx)[0]

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

    expect(emitFile).not.toHaveBeenCalled()
    expect(addWatchFile).not.toHaveBeenCalled()
  })

  it('keeps tokenMap scans for wxs hmr updates', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-file-hmr-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/wxs-card')
    await fs.ensureDir(componentDir)

    const vueFile = path.join(componentDir, 'index.vue')
    const wxsFile = path.join(componentDir, 'tools.wxs')
    await fs.writeFile(vueFile, '<template><view /></template>', 'utf8')
    await fs.writeFile(wxsFile, 'module.exports = { noop: function() {} }', 'utf8')

    const ctx = {
      configService: {
        absoluteSrcRoot: srcRoot,
        isDev: true,
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
        relativeOutputPath(filePath: string) {
          return path.relative(srcRoot, filePath).replace(/\\/g, '/')
        },
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {
              event: 'update',
              file: wxsFile,
            },
          },
        },
      },
      wxmlService: {
        tokenMap: new Map([
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
        ]),
      },
    } as any
    const plugin = wxs(ctx)[0]

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
    expect(emitFile.mock.calls[0][0].fileName).toBe('components/wxs-card/tools.wxs')
    expect(addWatchFile).toHaveBeenCalledWith(wxsFile)
  })

  it('keeps tokenMap scans for cached wxs importee hmr updates without wxs suffix', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-importee-hmr-'))
    tempDirs.push(tempDir)

    const srcRoot = path.join(tempDir, 'src')
    const componentDir = path.join(srcRoot, 'components/importee-card')
    await fs.ensureDir(componentDir)

    const vueFile = path.join(componentDir, 'index.vue')
    const wxsFile = path.join(componentDir, 'tools.wxs')
    const helperFile = path.join(componentDir, 'helper')
    await fs.writeFile(vueFile, '<template><view /></template>', 'utf8')
    await fs.writeFile(wxsFile, 'const helper = require("./helper"); module.exports = helper', 'utf8')
    await fs.writeFile(helperFile, 'module.exports = { noop: function() {} }', 'utf8')

    const ctx = {
      configService: {
        absoluteSrcRoot: srcRoot,
        isDev: true,
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
        relativeOutputPath(filePath: string) {
          return path.relative(srcRoot, filePath).replace(/\\/g, '/')
        },
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {},
          },
        },
      },
      wxmlService: {
        tokenMap: new Map([
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
        ]),
      },
    } as any
    const plugin = wxs(ctx)[0]

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
    emitFile.mockClear()
    addWatchFile.mockClear()
    ctx.runtimeState.build.hmr.profile = {
      event: 'update',
      file: helperFile,
    }

    await plugin.generateBundle?.call(
      {
        emitFile,
        addWatchFile,
      } as any,
      {},
      {},
    )

    expect(emitFile.mock.calls.map(([asset]) => asset.fileName)).toContain('components/importee-card/tools.wxs')
    expect(addWatchFile).toHaveBeenCalledWith(helperFile)
  })
})
