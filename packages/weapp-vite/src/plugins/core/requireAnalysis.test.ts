import { parseAst } from 'rollup/parseAst'
import { collectRequireTokens } from '../utils/ast'
import { isNativeSubPackageImport, rewriteAsyncDependencies, rewriteRequireCallbacks } from './requireAnalysis'

describe('require analysis', () => {
  it.each([
    ['native WeChat cross-package import', true, 'native', 'weapp', './feature.ts', '', 'packages/feature', false],
    ['preserve mode', false, 'preserve', 'weapp', './feature.ts', '', 'packages/feature', false],
    ['deprecated inline mode', false, 'inline', 'weapp', './feature.ts', '', 'packages/feature', false],
    ['non-WeChat platform', false, 'native', 'alipay', './feature.ts', '', 'packages/feature', false],
    ['bare module', false, 'native', 'weapp', 'feature', '', 'packages/feature', false],
    ['same package', false, 'native', 'weapp', './feature.ts', 'packages/feature', 'packages/feature', false],
    ['undeclared package', false, 'native', 'weapp', './feature.ts', '', '', false],
    ['independent package', false, 'native', 'weapp', './feature.ts', '', 'packages/feature', true],
  ])('checks native import eligibility for %s', (
    _caseName,
    expected,
    dynamicImports,
    platform,
    request,
    importerPackageRoot,
    targetPackageRoot,
    independentTarget,
  ) => {
    expect(isNativeSubPackageImport({
      dynamicImports,
      importerPackageRoot,
      independentTarget,
      platform,
      request,
      targetPackageRoot,
    })).toBe(expected)
  })

  it('normalizes callback require through the native Promise loader', () => {
    const code = `
require('./sync')
require('./callback', onLoaded, onError)
const promise = require.async('./promise')
`
    const ast = parseAst(code)
    const { requireCallbackTokens } = collectRequireTokens(ast)
    const result = rewriteRequireCallbacks(code, requireCallbackTokens)

    expect(result?.code).toContain(`require('./sync')`)
    expect(result?.code).toContain(`void require.async('./callback').then(onLoaded, onError)`)
    expect(result?.code).toContain(`const promise = require.async('./promise')`)
  })

  it('normalizes nested callback requires without overlapping edits', () => {
    const code = `
require('./outer', () => {
  require('./inner', onLoaded, onError)
}, onError)
`
    const ast = parseAst(code)
    const { requireCallbackTokens } = collectRequireTokens(ast)
    const result = rewriteRequireCallbacks(code, requireCallbackTokens)

    expect(result?.code).toContain(`void require.async('./outer').then(() => {`)
    expect(result?.code).toContain(`void require.async('./inner').then(onLoaded, onError)`)
  })

  it('rewrites emitted paths and eligible dynamic imports together', () => {
    const code = `
require('./callback.ts', onLoaded, onError)
const promise = require.async('./promise.ts')
const nativeModule = import('../../subpackages/native/index.ts')
`
    const ast = parseAst(code)
    const { dynamicImportTokens, requireCallbackTokens, requireTokens } = collectRequireTokens(ast)
    const result = rewriteAsyncDependencies(code, {
      dependencyRewrites: [
        ...requireTokens.map((token, index) => ({
          end: token.end,
          start: token.start,
          value: index === 0 ? './callback.js' : './promise.js',
        })),
        {
          end: dynamicImportTokens[0]!.end,
          start: dynamicImportTokens[0]!.start,
          value: '../../subpackages/native/index.js',
        },
      ],
      nativeImportTokens: dynamicImportTokens,
      requireCallbackTokens,
    })

    expect(result?.code).toContain(`void require.async("./callback.js").then(onLoaded, onError)`)
    expect(result?.code).toContain(`const promise = require.async("./promise.js")`)
    expect(result?.code).toContain(`const nativeModule = require.async("../../subpackages/native/index.js")`)
  })
})
