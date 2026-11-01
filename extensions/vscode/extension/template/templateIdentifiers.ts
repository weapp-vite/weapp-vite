import type { SourceRange } from '@weapp-vite/language-service'
import { analyzeScript } from '@weapp-vite/language-service'

export interface ExpressionIdentifier extends SourceRange {
  name: string
  declaration?: SourceRange
}

const cache = new Map<string, ExpressionIdentifier[]>()
const PREFIX = 'var __weappExpression = ('

/** 用共享脚本作用域排除字符串、注释和属性名，避免重命名误改模板字面量。 */
export function getExpressionIdentifiers(expression: string, start: number): ExpressionIdentifier[] {
  let identifiers = cache.get(expression)
  if (!identifiers) {
    const analysis = analyzeScript({ source: `${PREFIX}${expression}\n)`, fileName: 'template-expression.js', sourceKind: 'compiled' })
    identifiers = analysis.symbols.filter(symbol => symbol.start >= PREFIX.length && symbol.end <= PREFIX.length + expression.length && symbol.kind !== 'export')
      .map(symbol => ({
        name: symbol.name,
        start: symbol.start - PREFIX.length,
        end: symbol.end - PREFIX.length,
        ...(symbol.declaration && symbol.declaration.start >= PREFIX.length
          ? { declaration: { start: symbol.declaration.start - PREFIX.length, end: symbol.declaration.end - PREFIX.length } }
          : symbol.kind === 'declaration' ? { declaration: { start: symbol.start - PREFIX.length, end: symbol.end - PREFIX.length } } : {}),
      }))
    cache.set(expression, identifiers)
    if (cache.size > 64) {
      cache.delete(cache.keys().next().value!)
    }
  }
  return identifiers.map(identifier => ({
    ...identifier,
    start: identifier.start + start,
    end: identifier.end + start,
    ...(identifier.declaration ? { declaration: { start: identifier.declaration.start + start, end: identifier.declaration.end + start } } : {}),
  }))
}
