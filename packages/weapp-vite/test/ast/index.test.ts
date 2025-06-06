import fs from 'fs-extra'
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
    const { requireModules } = collectRequireTokens(ast)

    expect(requireModules).toMatchSnapshot()
    expect(ms.toString()).toMatchSnapshot()
    for (const m of requireModules) {
      const x = ms.slice(m.start, m.end)
      expect(x).toMatchSnapshot()
    }
  })

  it('case0.js', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/case0.js'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const { requireModules } = collectRequireTokens(ast)
    expect(requireModules).toMatchSnapshot('requireModules')
  })

  it('case1.js', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/case1.js'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const { requireModules } = collectRequireTokens(ast)
    expect(requireModules).toMatchSnapshot('requireModules')
  })

  it('case2.js', async () => {
    const code = normalizeCode(await fs.readFile(path.resolve(__dirname, './fixtures/case2.js'), 'utf-8'))
    const ast = await parseAstAsync(code)
    const { requireModules } = collectRequireTokens(ast)
    expect(requireModules).toMatchSnapshot('requireModules')
  })
})
