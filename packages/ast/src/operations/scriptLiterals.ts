const JS_STRING_LITERALS_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g
const SCRIPT_CALL_EXPRESSION_RE = /\b[$a-z_][\w$]*\s*\((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^()"'`])*\)/gi
const SCRIPT_CALL_OR_MODULE_RE = /\b(?:import|export)\b|\b[$a-z_][\w$]*\s*\(/i

/**
 * 收集脚本中的字符串字面量源码片段，供上层语义按需筛选。
 */
export function collectScriptStringLiterals(code: string) {
  const candidates: string[] = []
  for (const match of code.matchAll(JS_STRING_LITERALS_RE)) {
    candidates.push(match[0]!)
  }
  return candidates
}

/**
 * 收集调用表达式中的字符串字面量源码片段。
 */
export function collectScriptCallStringLiterals(code: string) {
  const candidates = new Set<string>()
  for (const callMatch of code.matchAll(SCRIPT_CALL_EXPRESSION_RE)) {
    for (const literalMatch of callMatch[0]!.matchAll(JS_STRING_LITERALS_RE)) {
      candidates.add(literalMatch[0]!)
    }
  }
  return Array.from(candidates).sort()
}

/**
 * 快速判断脚本是否包含调用或模块语法，避免上层无条件扩大候选集。
 */
export function mayContainScriptCallOrModuleSyntax(code: string) {
  return SCRIPT_CALL_OR_MODULE_RE.test(code)
}
