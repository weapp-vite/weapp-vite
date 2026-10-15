import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const loaderUrl = new URL('./babelLoader.ts', import.meta.url).href
const facadeUrl = new URL('./babel.ts', import.meta.url).href
const coreUrl = pathToFileURL(createRequire(import.meta.url).resolve('@babel/core')).href
const weappRequire = createRequire(new URL('../../weapp-vite/package.json', import.meta.url))
const compilerRequire = createRequire(new URL('../../../packages-runtime/wevu-compiler/package.json', import.meta.url))

async function runFreshProcess(body: string) {
  const { stdout } = await execFileAsync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', body], {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  })
  return JSON.parse(stdout) as Record<string, unknown>
}

it('keeps construction lazy, primes owned dependencies once, and retries only a rejected consumer', async () => {
  const result = await runFreshProcess(`
    import { createRequire, registerHooks } from 'node:module'
    const requests = []
    registerHooks({ resolve(specifier, context, next) {
      if (context.parentURL === ${JSON.stringify(loaderUrl)} && specifier.startsWith('@babel/')) requests.push(specifier)
      return next(specifier, context)
    } })
    const { createBabelBackendLoader } = await import(${JSON.stringify(loaderUrl)})
    const require = createRequire(${JSON.stringify(loaderUrl)})
    let imports = 0
    const loadCore = createBabelBackendLoader(() => { imports++; return import(${JSON.stringify(coreUrl)}) })
    const before = requests.slice()
    const first = loadCore()
    const shared = first === loadCore()
    const core = await first
    const after = requests.slice()
    let failureCode
    try { core.transformSync('export const =', { babelrc: false, configFile: false }) }
    catch (error) { failureCode = error.code }
    const transformRetry = core.transformSync('export const value = 42', { babelrc: false, configFile: false })
    let attempts = 0
    const error = new Error('expected importer failure')
    const loadRetry = createBabelBackendLoader(() => {
      attempts++
      if (attempts === 1) throw error
      return Promise.resolve({ value: 42 })
    })
    const rejected = loadRetry()
    const sharedRejected = rejected === loadRetry()
    const sameError = await rejected.catch(caught => caught === error)
    const retry = await loadRetry()
    process.stdout.write(JSON.stringify({
      before, after, final: requests, shared, imports, sharedRejected, sameError, attempts, retry,
      unaffected: first === loadCore(), failureCode, transformRetry: transformRetry.code.includes('value'),
      ready: ['@babel/parser', '@babel/generator', '@babel/traverse', '@babel/types'].every(id => Boolean(require(id))),
    }))
  `)

  const dependencies = ['@babel/core', '@babel/parser', '@babel/generator', '@babel/traverse', '@babel/types']
  expect(result).toEqual({
    before: [],
    after: dependencies,
    final: dependencies,
    shared: true,
    imports: 1,
    sharedRejected: true,
    sameError: true,
    attempts: 2,
    retry: { value: 42 },
    unaffected: true,
    failureCode: 'BABEL_PARSE_ERROR',
    transformRetry: true,
    ready: true,
  })
})

it('allows native ESM backend imports alongside all synchronous AST primitives', async () => {
  const pluginUrl = pathToFileURL(weappRequire.resolve('@babel/plugin-transform-modules-commonjs')).href
  const envUrl = pathToFileURL(weappRequire.resolve('@babel/preset-env')).href
  const tsUrl = pathToFileURL(weappRequire.resolve('@babel/preset-typescript')).href
  const jsxUrl = pathToFileURL(compilerRequire.resolve('@vue/babel-plugin-jsx')).href
  // 这个进程不能使用 tsx/registerHooks，否则可能将 linking 同步化并掩盖竞争。
  const result = await runFreshProcess(`
    const [{ createBabelBackendLoader }, facade] = await Promise.all([
      import(${JSON.stringify(loaderUrl)}), import(${JSON.stringify(facadeUrl)}),
    ])
    const primitive = Promise.resolve().then(() => {
      const ast = facade.parseJsLike('export const value: number = 42')
      facade.traverse(ast, { noScope: true })
      return { code: facade.generate(ast).code, keys: Boolean(facade.getVisitorKeys().Identifier) }
    })
    const loadModules = createBabelBackendLoader(() => Promise.all([
      import(${JSON.stringify(coreUrl)}), import(${JSON.stringify(pluginUrl)}),
    ]))
    const loadWxs = createBabelBackendLoader(() => Promise.all([
      import(${JSON.stringify(envUrl)}), import(${JSON.stringify(tsUrl)}),
    ]))
    const loadJsx = createBabelBackendLoader(() => import(${JSON.stringify(jsxUrl)}))
    const [analysis, [core, plugin], presets, jsx] = await Promise.all([
      primitive, loadModules(), loadWxs(), loadJsx(),
    ])
    const source = 'export const value = 42'
    const options = { babelrc: false, configFile: false, filename: 'app.js', sourceMaps: true, plugins: [plugin.default] }
    const sync = core.transformSync(source, options)
    const async = await core.transformAsync(source, options)
    const wxs = core.transformSync(analysis.code, {
      babelrc: false, configFile: false, filename: 'script.ts',
      presets: [[presets[0].default, { targets: { ie: '11' }, modules: 'commonjs' }], presets[1].default],
    })
    const vue = core.transformSync('export default { render() { return <view /> } }', {
      babelrc: false, configFile: false, filename: 'component.tsx', plugins: [jsx.default],
      parserOpts: { plugins: ['typescript', 'jsx'] },
    })
    process.stdout.write(JSON.stringify({
      keys: analysis.keys, host: async.code.includes('exports.value'),
      sameTransform: sync.code === async.code, sameMap: JSON.stringify(sync.map) === JSON.stringify(async.map),
      sources: async.map.sources, sourcesContent: async.map.sourcesContent,
      wxs: !wxs.code.includes(': number') && wxs.code.includes('exports.value'),
      jsx: !vue.code.includes('<view'),
    }))
  `)

  expect(result).toEqual({
    keys: true,
    host: true,
    sameTransform: true,
    sameMap: true,
    sources: ['app.js'],
    sourcesContent: ['export const value = 42'],
    wxs: true,
    jsx: true,
  })
})
