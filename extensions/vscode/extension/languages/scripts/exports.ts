import type { ScriptExportScope, ScriptExternalUse } from '@weapp-vite/language-service'
import type { ScriptModel, ScriptTarget } from './model'
import { getScriptTemplateExports } from '@weapp-vite/language-service'

type ImportedSymbol = Pick<ScriptExternalUse, 'imported' | 'targetScope' | 'targetPath'>

/** require 访问的是编译后 CJS 空间，由共享映射还原源码导出身份。 */
export function resolveImportedScriptSymbol(target: ScriptModel, use: ImportedSymbol) {
  if (use.targetScope === 'commonjs') {
    const path = use.targetPath ?? [use.imported]
    return getScriptTemplateExports(target.analysis, target.input).exports.find(item => item.path.length === path.length && item.path.every((part, index) => part === path[index]))?.symbol
  }
  return target.analysis.symbols.find(symbol => symbol.kind === 'export' && symbol.name === use.imported && symbol.exportScope === use.targetScope)
}

export function matchesImportedScriptSymbol(target: ScriptModel, use: ImportedSymbol, name: string, scope: ScriptExportScope) {
  const symbol = resolveImportedScriptSymbol(target, use)
  return symbol?.name === name && symbol.exportScope === scope
}

export function scriptTargetCompletionNames(target: ScriptTarget, path?: string[]) {
  if (target.scope === 'commonjs') {
    const parent = path ?? []
    return [...new Set(getScriptTemplateExports(target.model.analysis, target.model.input).exports.filter(item => item.path.length === parent.length + 1 && parent.every((name, index) => item.path[index] === name)).map(item => item.path.at(-1)!))]
  }
  return [...new Set(target.model.analysis.symbols.filter(symbol => symbol.kind === 'export' && (symbol.exportScope === target.scope || (target.scope === 'named' && symbol.exportScope === 'default'))).map(symbol => symbol.name))]
}
