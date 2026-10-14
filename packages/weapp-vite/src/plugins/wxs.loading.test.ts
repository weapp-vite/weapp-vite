import { expect, it } from 'vitest'
import { runModuleLoadingProcess } from '../../test/utils/moduleLoadingProcess'

interface WxsLoadingResult {
  initial: string[]
  empty: string[]
  missing: string[]
  loaded: string[]
  compilerLoads: number
  presetLoads: number
  failureCode: string
  emittedBeforeRetry: number
  firstFiles: string[]
  secondFiles: string[]
  firstHelper: string
  secondHelper: string
  watches: string[]
}

it('loads the real WXS compiler only for readable inputs and transforms fresh dependencies after failure', async () => {
  const pluginUrl = new URL('./wxs.ts', import.meta.url).href
  const compilerUrl = new URL('../wxs/index.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<WxsLoadingResult>(`
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-wxs-loading-'))
    const presetUrl = pathToFileURL(createRequire(${JSON.stringify(pluginUrl)}).resolve('@babel/preset-env')).href
    // scanner 现有的内置组件依赖也会使用 Babel core；这里只约束 WXS 专属转换依赖。
    const compilers = () => loadedModules().filter(url => url === ${JSON.stringify(compilerUrl)}
      || url.includes('/node_modules/@babel/preset-env/'))
    try {
      const { wxs } = await import(${JSON.stringify(pluginUrl)})
      const tokenMap = new Map()
      const plugin = wxs({
        configService: {
          absoluteSrcRoot: root, platform: 'weapp',
          outputExtensions: { wxml: 'wxml', wxs: 'wxs' },
          relativeOutputPath(file) { return path.relative(root, file).replaceAll('\\\\', '/') },
        },
        wxmlService: { tokenMap },
      })[0]
      let emitted = []
      const watches = []
      const host = { emitFile(asset) { emitted.push(asset) }, addWatchFile(file) { watches.push(file) } }
      const generate = () => plugin.generateBundle.call(host, {}, {
        'index.wxml': { type: 'asset', source: '<view />' },
      })
      const initial = compilers()
      await generate()
      const empty = compilers()
      tokenMap.set(path.join(root, 'index.wxml'), {
        deps: [{ tagName: 'wxs', value: './main.wxs', attrs: { src: './main.wxs' } }],
      })
      await generate()
      const missing = compilers()
      await writeFile(path.join(root, 'main.wxs'), 'module.exports = {')
      let failureCode
      try { await generate() }
      catch (error) { failureCode = error.code }
      const emittedBeforeRetry = emitted.length
      await writeFile(path.join(root, 'main.wxs'), 'var helper = require("./helper.wxs"); module.exports = { value: helper.value }')
      await writeFile(path.join(root, 'helper.wxs'), 'module.exports = { value: 42 }')
      await generate()
      const firstFiles = emitted.map(asset => asset.fileName).sort()
      const firstHelper = emitted.find(asset => asset.fileName === 'helper.wxs').source
      emitted = []
      await writeFile(path.join(root, 'helper.wxs'), 'module.exports = { value: 43 }')
      await generate()
      process.stdout.write(JSON.stringify({
        initial, empty, missing, loaded: compilers(), failureCode, emittedBeforeRetry,
        compilerLoads: moduleLoads.filter(url => url === ${JSON.stringify(compilerUrl)}).length,
        presetLoads: moduleLoads.filter(url => url === presetUrl).length,
        firstFiles, secondFiles: emitted.map(asset => asset.fileName).sort(), firstHelper,
        secondHelper: emitted.find(asset => asset.fileName === 'helper.wxs').source, watches,
      }))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  `)

  expect(result.initial).toEqual([])
  expect(result.empty).toEqual([])
  expect(result.missing).toEqual([])
  expect(result.loaded).toContain(compilerUrl)
  expect(result.loaded.some(url => url.includes('/node_modules/@babel/preset-env/'))).toBe(true)
  expect(result.compilerLoads).toBe(1)
  expect(result.presetLoads).toBe(1)
  expect(result.failureCode).toBe('BABEL_PARSE_ERROR')
  expect(result.emittedBeforeRetry).toBe(0)
  expect(result.firstFiles).toEqual(['helper.wxs', 'main.wxs'])
  expect(result.secondFiles).toEqual(result.firstFiles)
  expect(result.firstHelper).toMatch(/value:\s*42/)
  expect(result.secondHelper).toMatch(/value:\s*43/)
  expect(result.watches).toEqual([])
}, 20_000)
