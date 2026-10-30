import type { ScriptAnalysis, ScriptSymbol, SourceRange } from '@weapp-vite/language-service'
import { analyzeScript } from '@weapp-vite/language-service'

interface ScriptEdit extends SourceRange { text: string }

function binding(symbol: ScriptSymbol) {
  return symbol.declaration ?? symbol
}

export function isScriptIdentifierName(name: string) {
  return /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(name)
    && analyzeScript({ source: `export const ${name} = 0`, fileName: 'rename.js', sourceKind: 'compiled' }).valid
}

/** AST 明确区分公开名与本地绑定，shorthand 重命名保留另一侧名称。 */
export function getScriptRenameEdits(analysis: ScriptAnalysis, target: ScriptSymbol, name: string, publicName = false): ScriptEdit[] | undefined {
  if (!target.rename || !isScriptIdentifierName(name)) {
    return undefined
  }
  if (publicName && target.rename.kind !== 'binding') {
    const text = target.rename.kind === 'property-shorthand'
      ? `${name}: ${target.rename.localName}`
      : target.rename.kind === 'export-shorthand' ? `${target.rename.localName} as ${name}` : name
    return [{ start: target.start, end: target.end, text }]
  }
  const declaration = binding(target)
  // 拒绝可能捕获现有绑定或自由引用的名称，避免跨作用域写入错误结果。
  if (name !== target.name && analysis.symbols.some((symbol) => {
    const owner = binding(symbol)
    return symbol.kind !== 'export' && symbol.name === name && (owner.start !== declaration.start || owner.end !== declaration.end)
  })) {
    return undefined
  }
  const edits = new Map<string, ScriptEdit>()
  for (const symbol of analysis.symbols) {
    const owner = binding(symbol)
    if (symbol.name !== target.name || owner.start !== declaration.start || owner.end !== declaration.end || !symbol.rename) {
      continue
    }
    if (symbol.kind === 'export' && symbol.rename.kind !== 'binding') {
      continue
    }
    const text = symbol.rename.kind === 'property-shorthand'
      ? `${symbol.name}: ${name}`
      : symbol.rename.kind === 'export-shorthand'
        ? `${name} as ${symbol.name}`
        : symbol.rename.kind === 'import-shorthand' ? `${symbol.name} as ${name}` : name
    edits.set(`${symbol.start}:${symbol.end}`, { start: symbol.start, end: symbol.end, text })
  }
  return [...edits.values()]
}
