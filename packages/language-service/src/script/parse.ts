import type { Diagnostic } from '../types'
import type { ScriptDialect, ScriptOptions, ScriptSourceKind } from './types'
import { parse } from '@weapp-vite/ast'
import { findTrailingScriptComment } from './scanner'

export interface ScriptProfile {
  dialect: ScriptDialect
  sourceKind: ScriptSourceKind
  typed: boolean
  filter: boolean
}

/** 原生扩展与需要构建的脚本源使用不同约束，不因相同的 SJS 后缀推断平台。 */
export function resolveScriptProfile(fileName: string, options: ScriptOptions): ScriptProfile {
  const cleanName = fileName.replace(/[?#].*$/, '')
  const dialect = options.dialect ?? (/\.wxs(?:\.[cm]?[jt]s)?$/i.test(cleanName)
    ? 'wxs'
    : /\.sjs(?:\.[cm]?[jt]s)?$/i.test(cleanName) ? 'sjs' : /\.ks(?:\.[cm]?[jt]s)?$/i.test(cleanName) ? 'ks' : 'javascript')
  return {
    dialect,
    sourceKind: options.sourceKind ?? (/\.(?:wxs|sjs|ks)$|\.filter\.js$/i.test(cleanName) ? 'native' : 'compiled'),
    typed: options.language === 'typescript' || /\.[cm]?tsx?$/i.test(cleanName),
    filter: options.platform === 'swan' && /\.filter\.[jt]s$/i.test(cleanName),
  }
}

/** 只在虚拟解析输入补齐合法的 WXS 结尾注释，原文与偏移保持不变。 */
export function parseScript(source: string, fileName: string, profile: ScriptProfile) {
  const trailingComment = profile.dialect === 'wxs' && profile.sourceKind === 'native'
    ? findTrailingScriptComment(source)
    : undefined
  const parsedSource = trailingComment === undefined ? source : `${source}*/`
  try {
    const ast = parse(parsedSource, {
      sourceFilename: fileName,
      sourceType: 'unambiguous',
      plugins: profile.typed ? ['typescript'] : [],
      attachComment: false,
    })
    return { ast, parsedSource, trailingComment, diagnostic: undefined }
  }
  catch (error) {
    const detail = error as { pos?: number, message?: string }
    const start = Math.max(0, Math.min(source.length, detail.pos ?? 0))
    const diagnostic: Diagnostic = {
      code: 'script/syntax',
      message: detail.message ?? '脚本语法无法解析。',
      severity: 'error',
      start,
      end: Math.min(source.length, start + 1),
    }
    return { ast: undefined, parsedSource, trailingComment, diagnostic }
  }
}

const POSITION_KEYS = new Set(['start', 'end', 'loc', 'extra', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'errors'])

/** 排除位置与打印细节，保留指令、字面量和所有语法节点的语义结构。 */
export function scriptFingerprint(value: unknown): string {
  function normalize(input: unknown): unknown {
    if (Array.isArray(input)) {
      return input.filter(item => !(item && typeof item === 'object' && 'type' in item && item.type === 'EmptyStatement')).map(normalize)
    }
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input)
        .filter(([key]) => !POSITION_KEYS.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]))
    }
    return input
  }
  return JSON.stringify(normalize(value))
}
