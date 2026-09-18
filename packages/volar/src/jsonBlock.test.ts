import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { resolveEmbeddedJsonBlock } from './jsonBlock'

describe('config blocks with compiler-only AST nodes', () => {
  it.each(['ts', 'js'])('preserves expression mappings and surrounding code (%s)', (lang) => {
    const code = '// config\nconst title = \'Cart\'\nexport default /* value */ { navigationBarTitleText: title };\n// end\n'
    const compiler = new Proxy(ts, {
      get(target, key) {
        if (key === 'createSourceFile') {
          return (...args: Parameters<typeof ts.createSourceFile>) => {
            const source = target.createSourceFile(...args)
            const stripMethods = (node: ts.Node) => {
              Object.defineProperties(node, {
                getStart: { value: undefined },
                getEnd: { value: undefined },
              })
              ts.forEachChild(node, stripMethods)
            }
            stripMethods(source)
            return source
          }
        }
        return Reflect.get(target, key)
      },
    })
    const embedded = { id: 'json_0', content: [] as any[] }
    resolveEmbeddedJsonBlock('src/pages/cart/index.vue', {
      customBlocks: [{ type: 'json', lang, content: code, name: 'config' }],
    }, embedded, compiler, true)

    const expression = '{ navigationBarTitleText: title }'
    expect(embedded.content).toContainEqual(expect.arrayContaining([
      expression,
      'config',
      code.indexOf(expression),
    ]))
    const text = embedded.content.map(segment => segment[0]).join('')
    expect(text).toContain('// config\nconst title = \'Cart\'\n')
    expect(text).toContain(`export default __weapp_defineConfig(${expression})`)
    expect(text).toContain('// end')
  })
})
