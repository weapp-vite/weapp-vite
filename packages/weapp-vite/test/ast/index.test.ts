import { fs } from '@weapp-core/shared/fs'
import MagicString from 'magic-string'
import path from 'pathe'
import { parseAst, parseAstAsync } from 'rollup/parseAst'
import { collectRequireTokens } from '@/plugins/utils/ast'

function normalizeCode(code: string) {
  return code.replace(/\r\n/g, '\n')
}

describe('require', () => {
  it('should 0', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/require/index.ts'), 'utf-8'))
    const ast = parseAst(code)
    expect(ast).toMatchSnapshot()
  })

  it('should 1', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/require/index.ts'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const ms = new MagicString(code)
    const { requireTokens } = collectRequireTokens(ast)

    expect(requireTokens).toMatchSnapshot()
    expect(ms.toString()).toMatchSnapshot()
    for (const m of requireTokens) {
      const x = ms.slice(m.start, m.end)
      expect(x).toMatchSnapshot()
    }
  })

  it('collects callback and Promise subpackage requires without treating sync require as async', async () => {
    const code = `
require('./sync')
require('./callback', onLoaded, onError)
const promise = require.async('./promise')
promise.then(onLoaded, onError)
`
    const ast = await parseAstAsync(code)
    const { requireTokens } = collectRequireTokens(ast)

    expect(requireTokens.map(({ async, value }) => ({ async, value }))).toEqual([
      { async: true, value: './callback' },
      { async: true, value: './promise' },
    ])
  })

  it('collects only static dynamic import dependencies', async () => {
    const code = `
import('./literal.ts')
import(\`./template.ts\`)
import(\`./\${name}.ts\`)
`
    const ast = await parseAstAsync(code)
    const { dynamicImportTokens } = collectRequireTokens(ast)

    expect(dynamicImportTokens.map(({ value }) => value)).toEqual([
      './literal.ts',
      './template.ts',
    ])
  })

  it('case0.js', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/case0.js'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const { requireTokens } = collectRequireTokens(ast)
    expect(requireTokens).toMatchSnapshot('requireTokens')
  })

  it('case1.js', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/case1.js'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const { requireTokens } = collectRequireTokens(ast)
    expect(requireTokens).toMatchSnapshot('requireTokens')
  })

  it('case2.js', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/case2.js'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const { requireTokens } = collectRequireTokens(ast)
    expect(requireTokens).toMatchSnapshot('requireTokens')
  })
})
