import type { types as BabelTypes, NodePath } from '@babel/core'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { parseSync, types as t, transformFromAstSync } from '@babel/core'
import { describe, expect, it, vi } from 'vitest'
import { taroHarmonyPageFiles } from './taroHarmony'

const pageName = 'pages/home/index'
const pageLoader = 'official-taro-loader/lib/page.js'
const compatibilityLoader = 'controlled-harmony-page/loader.cjs'
const sourceFile = 'src/pages/home/index.jsx'
const officialSha = '69cdb1ffc0c694180880b71f767ca1ac519f481151fb07a016f1194930a025b3'
const sourceModule = { exports: undefined as unknown as (source: string, name: string) => string }
runInNewContext(taroHarmonyPageFiles['harmony-jsui-page/source.cjs']!, {
  module: sourceModule,
  require: (name: string) => name === 'node:assert/strict' ? assert : { parseSync, types: t },
})
const adaptSource = sourceModule.exports

/** 按冻结官方 page.js 的公开生成协议构造模块，真实官方包的两模式编译另由集成验收覆盖。 */
function officialPageOutput(name = pageName) {
  return `import { createPageConfig } from '@tarojs/runtime'
import component from '!entry-cache.js?name=${name}!./index.jsx'
var config = {"title":"kept"};
export default (createPageConfig.bind(null, component, '${name}', {root:{cn:[]}}, config || {}))
export default component
`
}

function loadCompatibility(mode: string) {
  const environment = { TARO_ENV: 'harmony', TARO_PLATFORM: 'harmony', NODE_ENV: mode, CORPUS_BUILD_MODE: mode }
  const report = vi.fn()
  const module = { exports: undefined as unknown as (this: object, source: string) => string }
  runInNewContext(taroHarmonyPageFiles['harmony-jsui-page/loader.cjs']!, {
    module,
    console: { log: report },
    require: (name: string) => {
      if (name === 'node:assert/strict') {
        return assert
      }
      if (name === 'node:process') {
        return { env: environment }
      }
      if (name === '@tarojs/helper') {
        return { META_TYPE: { PAGE: 'PAGE' } }
      }
      if (name === './source.cjs') {
        return adaptSource
      }
      throw new Error(`Unexpected compatibility dependency: ${name}`)
    },
  })
  const loaderMeta = { modifyInstantiate() {} }
  const options = { mode, name: pageName, resourcePath: sourceFile, pageLoader, loaderMeta }
  const loaders = [{ path: compatibilityLoader, options }, { path: pageLoader, options: { name: pageName, loaderMeta } }]
  const context = { getOptions: () => options, _module: { miniType: 'PAGE' }, resourcePath: sourceFile, loaderIndex: 0, loaders }
  return { run: (source = officialPageOutput()) => module.exports.call(context, source), context, options, environment, report }
}

function pagePluginHarness(overrides: { version?: string, sha?: string } = {}) {
  interface Module { miniType: string, name: string, resource: string, loaders: Array<{ loader: string, options: Record<string, unknown> }> }
  const taps: Array<{ stage: number, fn: (context: object, module: Module) => void }> = []
  const compilation = {}
  const loaderMeta = { modifyInstantiate() {} }
  const hash = { update: vi.fn().mockReturnThis(), digest: vi.fn(() => overrides.sha ?? officialSha) }
  const readFile = vi.fn(() => 'immutable official loader bytes')
  const runnerRequire = Object.assign(() => ({ version: overrides.version ?? '4.3.2' }), { resolve: () => pageLoader })
  const requireModule = Object.assign((name: string) => {
    if (name === 'node:assert/strict') {
      return assert
    }
    if (name === 'node:crypto') {
      return { createHash: () => hash }
    }
    if (name === 'node:fs') {
      return { readFileSync: readFile }
    }
    if (name === 'node:module') {
      return { createRequire: () => runnerRequire }
    }
    if (name === '@tarojs/helper') {
      return { META_TYPE: { PAGE: 'PAGE' } }
    }
    throw new Error(`Unexpected compatibility dependency: ${name}`)
  }, { resolve: (name: string) => name === './loader.cjs' ? compatibilityLoader : 'official-runner/package.json' })
  const module = { exports: undefined as unknown as new (options: { loaderMeta: object, mode: string }) => { apply: (compiler: object) => void } }
  runInNewContext(taroHarmonyPageFiles['harmony-jsui-page/plugin.cjs']!, { module, require: requireModule })
  const compiler = {
    hooks: { compilation: { tap: (_name: string, fn: (compilation: object) => void) => fn(compilation) } },
    webpack: { NormalModule: { getCompilationHooks: (current: object) => {
      expect(current).toBe(compilation)
      return { loader: { tap: (options: { stage: number }, fn: (context: object, module: Module) => void) => taps.push({ ...options, fn }) } }
    } } },
  }
  const PageCompatibilityPlugin = module.exports
  new PageCompatibilityPlugin({ loaderMeta, mode: 'development' }).apply(compiler)
  const run = (target: Module) => [...taps].sort((a, b) => a.stage - b.stage).forEach(tap => tap.fn({}, target))
  return { run, taps, loaderMeta, hash, readFile }
}

describe('Harmony JSUI page module compatibility before Webpack parsing', () => {
  it.each(['development', 'production'])('preserves the PageConfig factory and source component in %s', (mode) => {
    const harness = loadCompatibility(mode)
    expect(() => parseSync(officialPageOutput(), { babelrc: false, configFile: false })).toThrow('Only one default export')
    const output = harness.run()
    const ast = parseSync(output, { babelrc: false, configFile: false })!
    expect(ast.program.body.filter(node => t.isExportDefaultDeclaration(node))).toHaveLength(1)
    const executable = transformFromAstSync(ast, output, { babelrc: false, configFile: false, plugins: [() => ({ visitor: {
      ImportDeclaration(path: NodePath<BabelTypes.ImportDeclaration>) { path.remove() },
      ExportDefaultDeclaration(path: NodePath<BabelTypes.ExportDefaultDeclaration>) {
        path.replaceWith(t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('module'), t.identifier('exports')), path.node.declaration as BabelTypes.Expression)))
      },
    } })] })!.code!
    const component = () => 'source component'
    const createPageConfig = vi.fn((...args: unknown[]) => args)
    const module = { exports: undefined as unknown as () => unknown }
    runInNewContext(executable, { module, component, createPageConfig })
    expect(createPageConfig).not.toHaveBeenCalled()
    expect(module.exports()).toEqual([component, pageName, { root: { cn: [] } }, { title: 'kept' }])
    expect(createPageConfig).toHaveBeenCalledOnce()
    expect(JSON.parse(harness.report.mock.calls[0]![0] as string)).toMatchObject({ mode, page: pageName, protocol: 'factory-default-without-duplicate-component' })
  })

  it('runs after the faithful official page loader protocol and before module parsing', () => {
    const plugin = pagePluginHarness()
    const page = { miniType: 'PAGE', name: pageName, resource: sourceFile, loaders: [] as Array<{ loader: string, options: Record<string, unknown> }> }
    plugin.taps.push({ stage: 0, fn: (_context, module) => module.loaders.unshift({ loader: '@tarojs/taro-loader/lib/page', options: { name: pageName, loaderMeta: plugin.loaderMeta } }) })
    plugin.run(page)
    expect(page.loaders.map(item => item.loader)).toEqual([compatibilityLoader, pageLoader])
    expect(page.loaders[1]!.options).toEqual({ name: pageName, loaderMeta: plugin.loaderMeta })
    expect(page.loaders[1]!.options.loaderMeta).toBe(plugin.loaderMeta)
    const order: string[] = []
    const output = page.loaders.reduceRight((source, loader) => {
      order.push(loader.loader)
      return loader.loader === compatibilityLoader ? loadCompatibility('development').run(source) : officialPageOutput()
    }, 'export default function SourcePage() {}')
    expect(order).toEqual([pageLoader, compatibilityLoader])
    expect(() => parseSync(output, { babelrc: false, configFile: false })).not.toThrow()
    expect(plugin.readFile).toHaveBeenCalledExactlyOnceWith(pageLoader)
    expect(plugin.hash.update).toHaveBeenCalledWith('immutable official loader bytes')
  })

  it('leaves non-page modules untouched and rejects loader, metadata, name and duplicate-install drift', () => {
    const harness = pagePluginHarness()
    const ordinary = { miniType: 'STATIC', name: 'container/index', resource: 'container.js', loaders: [] }
    harness.run(ordinary)
    expect(ordinary.loaders).toEqual([])
    const page = () => ({ miniType: 'PAGE', name: pageName, resource: sourceFile, loaders: [{ loader: pageLoader, options: { name: pageName, loaderMeta: harness.loaderMeta } }] })
    const missing = page()
    missing.loaders = []
    expect(() => harness.run(missing)).toThrow('exactly one official page loader')
    const metadata = page()
    metadata.loaders[0]!.options.loaderMeta = { modifyInstantiate() {} }
    expect(() => harness.run(metadata)).toThrow('shared official loader metadata')
    const renamed = page()
    renamed.loaders[0]!.options.name = 'different/page'
    expect(() => harness.run(renamed)).toThrow('name must match')
    const duplicate = page()
    harness.run(duplicate)
    expect(() => harness.run(duplicate)).toThrow('official page loader must execute last')
    expect(() => pagePluginHarness({ version: '4.3.3' })).toThrow('frozen Taro loader')
    expect(() => pagePluginHarness({ sha: 'changed' })).toThrow('official page loader source changed')
  })

  it.each([
    (source: string) => source.replace('export default component', 'export default otherComponent'),
    (source: string) => source.replace('createPageConfig.bind', 'createOtherConfig.bind'),
    (source: string) => source.replace('\'pages/home/index\'', '\'different/page\''),
    (source: string) => source.replace('{root:{cn:[]}}', '{root:{cn:[1]}}'),
    (source: string) => source.replace('config || {}', 'config || {changed:true}'),
    (source: string) => source.replace('from \'@tarojs/runtime\'', 'from \'another/runtime\''),
    (source: string) => `${source}export default third\n`,
    (source: string) => source.replace('export default component', 'const invalid = ;\nexport default component'),
    (source: string) => source.replace('var config', 'var unexpected;\nvar config'),
  ])('rejects changed official module syntax and preserves the original fatal', (change) => {
    expect(() => adaptSource(change(officialPageOutput()), pageName)).toThrow()
  })

  it('rejects platform, mode and loader execution drift', () => {
    const platform = loadCompatibility('development')
    platform.environment.TARO_PLATFORM = 'mini'
    expect(() => platform.run()).toThrow('genuine Harmony platform')
    const mode = loadCompatibility('production')
    mode.environment.NODE_ENV = 'development'
    expect(() => mode.run()).toThrow('requested Node mode')
    const loader = loadCompatibility('development')
    loader.context.loaders[1]!.path = 'another-loader.js'
    expect(() => loader.run()).toThrow('immediately after the frozen official page loader')
    const metadata = loadCompatibility('development')
    metadata.context.loaders[1]!.options = { ...metadata.context.loaders[1]!.options, loaderMeta: { modifyInstantiate() {} } }
    expect(() => metadata.run()).toThrow('loader metadata changed')
  })
})
