import type { Diagnostic } from '../types'
import type { FormatScriptOptions, ScriptFormatResult } from './types'
import { analyzeScript } from './analyze'
import { parseScript, resolveScriptProfile, scriptFingerprint } from './parse'

/** 通过注入的格式化器处理脚本；校验失败时保留原文并返回可定位诊断。 */
export async function formatScript(source: string, fileName: string, options: FormatScriptOptions): Promise<ScriptFormatResult> {
  const analysis = analyzeScript(source, fileName, options)
  const profile = resolveScriptProfile(fileName, options)
  const before = parseScript(source, fileName, profile)
  if (!analysis.valid || !before.ast) {
    return { code: source, diagnostics: analysis.diagnostics, changed: false }
  }
  const failure = (message: string): ScriptFormatResult => {
    const diagnostic: Diagnostic = { code: 'script/unsafe-format', message, severity: 'error', start: 0, end: source.length }
    return { code: source, diagnostics: [...analysis.diagnostics, diagnostic], changed: false }
  }
  let formatted: Awaited<ReturnType<FormatScriptOptions['format']>>
  try {
    formatted = await options.format(`${fileName}.${profile.typed ? 'ts' : 'js'}`, before.parsedSource, {
      ...(profile.sourceKind === 'native' && profile.dialect === 'wxs' ? { trailingComma: 'none' as const } : {}),
      embeddedLanguageFormatting: 'off',
    })
  }
  catch (error) {
    return failure(`脚本格式化失败：${error instanceof Error ? error.message : String(error)}`)
  }
  if (formatted.errors?.length) {
    return failure(formatted.errors.map(error => error.message).join('\n'))
  }
  let code = formatted.code
  if (before.trailingComment !== undefined) {
    const printed = parseScript(code, fileName, profile)
    const finalComment = printed.ast?.comments?.at(-1)
    if (!finalComment || finalComment.type !== 'CommentBlock' || finalComment.start == null || finalComment.end == null || code.slice(finalComment.end).trim()) {
      return failure('格式化器未保留 WXS 结尾注释，拒绝修改。')
    }
    code = code.slice(0, finalComment.start) + source.slice(before.trailingComment)
  }
  const after = parseScript(code, fileName, profile)
  if (!after.ast || scriptFingerprint(before.ast.program) !== scriptFingerprint(after.ast.program)) {
    return failure('格式化前后的脚本语义结构不同，拒绝修改。')
  }
  const checked = analyzeScript(code, fileName, options)
  if (!checked.valid) {
    return failure('格式化器生成了当前脚本方言不支持的代码，拒绝修改。')
  }
  return { code, diagnostics: analysis.diagnostics, changed: code !== source }
}
