import { collectRequireTokens } from '@/plugins/ast'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { parseAst, parseAstAsync } from 'rollup/parseAst'

// declare module 'estree-walker' {
//   export function walk<T>(
//     root: T,
//     options: {
//       enter?: (node: T, parent: T | null) => any
//       leave?: (node: T, parent: T | null) => any
//       exit?: (node: T) => any
//     } & ThisType<{ skip: () => void }>,
//   )
// }

// type TNode = AstNode & { source?: { type: string }, callee?: TNode & { name?: string }, args?: TNode[] }

describe('require', () => {
  it('should 0', async () => {
    const code = await fs.readFile(path.resolve(__dirname, './fixtures/require/index.ts'), 'utf-8')
    const ast = parseAst(code)
    expect(ast).toMatchSnapshot()
  })

  it('should 1', async () => {
    const code = await fs.readFile(path.resolve(__dirname, './fixtures/require/index.ts'), 'utf-8')
    const ast = await parseAstAsync(code)
    const ms = new MagicString(code)
    const { requireTokens, requireModules } = collectRequireTokens(ast)
    requireTokens.forEach((x) => {
      return ms.overwrite(x.start, x.end, x.value)
    })
    expect(requireModules).toMatchSnapshot()
    expect(ms.toString()).toMatchSnapshot()
    for (const m of requireModules) {
      const x = ms.slice(m.start, m.end)
      expect(x).toMatchSnapshot()
    }
  })
})
