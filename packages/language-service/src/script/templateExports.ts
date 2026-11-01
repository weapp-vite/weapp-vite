import type { ScriptAnalysis, ScriptExportScope, ScriptOptions, ScriptSymbol } from './types'

export interface ScriptTemplateExport {
  path: string[]
  targetScope: ScriptExportScope
  symbol: ScriptSymbol
}

export interface ScriptTemplateExports {
  exports: ScriptTemplateExport[]
  ambiguous: boolean
  reason?: string
}

/** 模板模块映射只采用已明确的导出契约；未知宿主的混合导出拒绝猜选同名符号。 */
export function getScriptTemplateExports(analysis: ScriptAnalysis, options: ScriptOptions = {}): ScriptTemplateExports {
  const symbols = analysis.symbols.filter(symbol => symbol.kind === 'export' && symbol.exportScope)
  const named = symbols.filter(symbol => symbol.exportScope === 'named')
  const defaults = symbols.filter(symbol => symbol.exportScope === 'default')
  const defaultMembers = symbols.filter(symbol => symbol.exportScope === 'default-member')
  const commonjs = symbols.filter(symbol => symbol.exportScope === 'commonjs')
  const hasDefault = defaults.length > 0 || defaultMembers.length > 0
  const item = (symbol: ScriptSymbol, path: string[]): ScriptTemplateExport => ({ path, targetScope: symbol.exportScope!, symbol })
  const normal = (values: ScriptSymbol[]) => values.map(symbol => item(symbol, symbol.name === 'default' && !symbol.rename ? [] : [symbol.name]))
  const ambiguous = (reason: string): ScriptTemplateExports => ({ exports: [], ambiguous: true, reason })
  if (commonjs.length && (named.length || hasDefault)) {
    return ambiguous('同一脚本混用 CommonJS 与 ESM 导出，模板公开成员无法可靠确定。')
  }
  const cjsPlatform = ['weapp', 'jd', 'xhs', 'qq', 'tt', 'ks'].includes(options.platform ?? '')
  const cjsDialect = analysis.dialect === 'wxs' || analysis.dialect === 'ks' || (analysis.dialect === 'sjs' && options.platform === 'tt')
  if (analysis.sourceKind === 'native' && cjsDialect) {
    return { exports: normal(commonjs), ambiguous: false }
  }
  if (analysis.sourceKind === 'compiled' && (cjsPlatform || cjsDialect)) {
    if (commonjs.length) {
      return { exports: normal(commonjs), ambiguous: false }
    }
    if (!named.length) {
      return { exports: [...defaultMembers.map(symbol => item(symbol, [symbol.name])), ...defaults.map(symbol => item(symbol, []))], ambiguous: false }
    }
    return { exports: [...normal(named), ...defaults.map(symbol => item(symbol, ['default'])), ...defaultMembers.map(symbol => item(symbol, ['default', symbol.name]))], ambiguous: false }
  }
  if (commonjs.length) {
    return { exports: normal(commonjs), ambiguous: false }
  }
  if (named.length && hasDefault) {
    return ambiguous('当前宿主的原生或 ESM 模板模块未核实混合导出映射；保留源码并停止不确定的跨文件重命名。')
  }
  if (hasDefault) {
    return { exports: [...defaultMembers.map(symbol => item(symbol, [symbol.name])), ...defaults.map(symbol => item(symbol, []))], ambiguous: false }
  }
  return { exports: normal(named), ambiguous: false }
}
