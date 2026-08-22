import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { wevuCompatibilityCatalog } from './compatibility'

function collectModuleTypeExports(entry: string) {
  const program = ts.createProgram([entry], {
    allowJs: false,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  })
  const source = program.getSourceFile(entry)
  const symbol = source && program.getTypeChecker().getSymbolAtLocation(source)
  if (!symbol) {
    throw new Error(`无法解析 TypeScript 模块：${entry}`)
  }
  const checker = program.getTypeChecker()
  return new Set(checker.getExportsOfModule(symbol)
    .filter((item) => {
      const target = (item.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(item) : item
      return (target.flags & ts.SymbolFlags.Type) !== 0
    })
    .map(item => item.name))
}

describe('Wevu same-name Vue types', () => {
  it('classifies every public type with the same exported name', () => {
    const wevuTypes = collectModuleTypeExports(new URL('../../../packages-runtime/wevu/src/index.ts', import.meta.url).pathname)
    const vueTypes = collectModuleTypeExports(new URL('../../../node_modules/vue/dist/vue.d.ts', import.meta.url).pathname)
    const overlaps = [...wevuTypes].filter(name => vueTypes.has(name)).sort()
    const classified = new Set(wevuCompatibilityCatalog
      .filter(item => item.upstream === 'vue' && item.surfaces.includes('type'))
      .map(item => item.api))
    const missing = overlaps.filter(name => !classified.has(name))

    expect(missing, `未分类的 Vue 同名类型：${missing.join(', ')}`).toEqual([])
  })
})
