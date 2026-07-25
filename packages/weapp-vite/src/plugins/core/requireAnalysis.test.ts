import { parseAst } from 'rollup/parseAst'
import { collectRequireTokens } from '../utils/ast'
import { rewriteRequireCallbacks } from './requireAnalysis'

describe('require analysis', () => {
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
})
