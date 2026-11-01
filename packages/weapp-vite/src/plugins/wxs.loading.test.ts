import { expect, it } from 'vitest'
import { runModuleLoadingProcess } from '../../test/utils/moduleLoadingProcess'

interface WxsLoadingResult {
  initial: string[]
  empty: string[]
  missing: string[]
  loaded: string[]
  compilerLoads: number
  presetRequests: number
  failureCode: string
  emittedBeforeRetry: number
  firstFiles: string[]
  secondFiles: string[]
  firstHelper: string
  secondHelper: string
  watches: string[]
}

it('loads the real WXS compiler only for readable typed inputs and transforms fresh dependencies after failure', async () => {
  const pluginUrl = new URL('./wxs.ts', import.meta.url).href
  const compilerUrl = new URL('../wxs/index.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<WxsLoadingResult>(`
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-wxs-loading-'))
    const presetFilename = createRequire(${JSON.stringify(pluginUrl)}).resolve('@babel/preset-env')
    const presetUrl = pathToFileURL(presetFilename).href
    const presetRequests = []
    // require(ESM) 不保证触发 load hook 或进入 require.cache，记录真实解析请求。
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context)
        if (specifier === '@babel/preset-env') presetRequests.push(resolved.url)
        return resolved
      },
    })
    // scanner 现有的内置组件依赖也会使用 Babel core；这里只约束 WXS 专属转换依赖。
    const compilers = () => loadedModules().filter(url => url === ${JSON.stringify(compilerUrl)}
      || url === presetUrl || url.includes('/node_modules/@babel/preset-env/'))
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
        deps: [{ tagName: 'wxs', value: './main.wxs.ts', attrs: { src: './main.wxs.ts' } }],
      })
      await generate()
      const missing = compilers()
      await writeFile(path.join(root, 'main.wxs.ts'), 'module.exports = {')
      let failureCode
      try { await generate() }
      catch (error) { failureCode = error.code }
      const emittedBeforeRetry = emitted.length
      await writeFile(path.join(root, 'main.wxs.ts'), 'import { value } from "./helper.wxs.ts"; export default { value }')
      await writeFile(path.join(root, 'helper.wxs.ts'), 'export const value: number = 42')
      await generate()
      const firstFiles = emitted.map(asset => asset.fileName).sort()
      const firstHelper = emitted.find(asset => asset.fileName === 'helper.wxs').source
      emitted = []
      await writeFile(path.join(root, 'helper.wxs.ts'), 'export const value: number = 43')
      await generate()
      process.stdout.write(JSON.stringify({
        initial, empty, missing, loaded: compilers(), failureCode, emittedBeforeRetry,
        compilerLoads: moduleLoads.filter(url => url === ${JSON.stringify(compilerUrl)}).length,
        presetRequests: presetRequests.length,
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
  expect(result.presetRequests).toBe(1)
  expect(result.failureCode).toBe('BABEL_PARSE_ERROR')
  expect(result.emittedBeforeRetry).toBe(0)
  expect(result.firstFiles).toEqual(['helper.wxs', 'main.wxs'])
  expect(result.secondFiles).toEqual(result.firstFiles)
  expect(result.firstHelper).toMatch(/module\.exports\.value\s*=\s*42/)
  expect(result.secondHelper).toMatch(/module\.exports\.value\s*=\s*43/)
  expect(result.watches).toEqual([])
}, 20_000)

it('validates native WXS without Babel presets and preserves fresh module sources byte for byte', async () => {
  const pluginUrl = new URL('./wxs.ts', import.meta.url).href
  const mainSource = '// native module\r\nvar helper = require("./helper.wxs"); module.exports = { value: helper.value }\r\n'
  const firstSource = '// initial helper\nmodule.exports={value:42}\n'
  const secondSource = '// updated helper\r\nmodule.exports={value:43}\r\n'
  const result = await runModuleLoadingProcess<{
    presetRequests: number
    failureName: string
    failureMessage: string
    emittedBeforeRetry: number
    firstFiles: string[]
    secondFiles: string[]
    firstMain: string
    secondMain: string
    firstHelper: string
    secondHelper: string
  }>(`
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-native-wxs-loading-'))
    const presetRequests = []
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === '@babel/preset-env') presetRequests.push(specifier)
        return nextResolve(specifier, context)
      },
    })
    try {
      const { wxs } = await import(${JSON.stringify(pluginUrl)})
      const plugin = wxs({
        configService: {
          absoluteSrcRoot: root, platform: 'weapp',
          outputExtensions: { wxml: 'wxml', wxs: 'wxs' },
          relativeOutputPath(file) { return path.relative(root, file).replaceAll('\\\\', '/') },
        },
        wxmlService: { tokenMap: new Map([[path.join(root, 'index.wxml'), {
          deps: [{ tagName: 'wxs', value: './main.wxs', attrs: { src: './main.wxs' } }],
        }]]) },
      })[0]
      let emitted = []
      const host = { emitFile(asset) { emitted.push(asset) }, addWatchFile() {} }
      const generate = () => plugin.generateBundle.call(host, {}, {})
      await writeFile(path.join(root, 'main.wxs'), 'module.exports = {')
      let failureName, failureMessage
      try { await generate() }
      catch (error) { failureName = error.name; failureMessage = error.message }
      const emittedBeforeRetry = emitted.length
      await writeFile(path.join(root, 'main.wxs'), ${JSON.stringify(mainSource)})
      await writeFile(path.join(root, 'helper.wxs'), ${JSON.stringify(firstSource)})
      await generate()
      const firstFiles = emitted.map(asset => asset.fileName).sort()
      const firstMain = emitted.find(asset => asset.fileName === 'main.wxs').source
      const firstHelper = emitted.find(asset => asset.fileName === 'helper.wxs').source
      emitted = []
      await writeFile(path.join(root, 'helper.wxs'), ${JSON.stringify(secondSource)})
      await generate()
      process.stdout.write(JSON.stringify({
        presetRequests: presetRequests.length, failureName, failureMessage, emittedBeforeRetry,
        firstFiles, secondFiles: emitted.map(asset => asset.fileName).sort(), firstMain, firstHelper,
        secondMain: emitted.find(asset => asset.fileName === 'main.wxs').source,
        secondHelper: emitted.find(asset => asset.fileName === 'helper.wxs').source,
      }))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  `)

  expect(result.presetRequests).toBe(0)
  expect(result.failureName).toBe('SyntaxError')
  expect(result.failureMessage).toContain('main.wxs:')
  expect(result.emittedBeforeRetry).toBe(0)
  expect(result.firstFiles).toEqual(['helper.wxs', 'main.wxs'])
  expect(result.secondFiles).toEqual(result.firstFiles)
  expect(result.firstMain).toBe(mainSource)
  expect(result.secondMain).toBe(mainSource)
  expect(result.firstHelper).toBe(firstSource)
  expect(result.secondHelper).toBe(secondSource)
}, 20_000)
