import type { VueLanguagePluginReturn } from '@vue/language-core'
import { PLUGIN_VERSION } from './constants'

const SERVICE_SCRIPT_RE = /^script_([jt]sx?)$/
const WHITESPACE_RE = /\s/
const LINE_TERMINATOR_RE = /[\n\r\u2028\u2029]/
const BROWSER_ELEMENTS = 'Omit<SVGElementTagNameMap, keyof HTMLElementTagNameMap> & HTMLElementTagNameMap'
const MINI_PROGRAM_ELEMENTS = 'import(\'wevu\').MiniProgramTemplateRefElements'
const LOCAL_ELEMENTS = `Omit<${BROWSER_ELEMENTS}, keyof ${MINI_PROGRAM_ELEMENTS}> & ${MINI_PROGRAM_ELEMENTS}`

/** 线性扫描首条上游语法指令，保留跨行分隔符及空白 key/value 的匹配边界。 */
function readCompilerDirective(comment: string): { key: string, value: string } | undefined {
  let cursor = 0
  while (cursor < comment.length) {
    while (cursor < comment.length && WHITESPACE_RE.test(comment[cursor]!)) {
      cursor += 1
    }
    if (cursor === comment.length) {
      return
    }
    if (comment[cursor] !== '@') {
      while (cursor < comment.length && !LINE_TERMINATOR_RE.test(comment[cursor]!)) {
        cursor += 1
      }
      continue
    }

    const keyStart = cursor + 1
    if (keyStart === comment.length || LINE_TERMINATOR_RE.test(comment[keyStart]!)) {
      cursor = keyStart
      continue
    }
    let separator = keyStart + 1
    while (separator < comment.length && !WHITESPACE_RE.test(comment[separator]!)) {
      separator += 1
    }
    if (separator === comment.length) {
      return
    }
    let valueStart = separator
    while (valueStart < comment.length && WHITESPACE_RE.test(comment[valueStart]!)) {
      valueStart += 1
    }
    const key = comment.slice(keyStart, separator)
    if (valueStart === comment.length) {
      // 贪婪分隔符回退时，须至少保留一个分隔字符和一个不换行的 value 字符。
      valueStart -= 1
      while (valueStart > separator && LINE_TERMINATOR_RE.test(comment[valueStart]!)) {
        valueStart -= 1
      }
      return valueStart > separator ? { key, value: comment[valueStart]! } : undefined
    }
    let valueEnd = valueStart
    while (valueEnd < comment.length && !LINE_TERMINATOR_RE.test(comment[valueEnd]!)) {
      valueEnd += 1
    }
    while (valueEnd > valueStart && WHITESPACE_RE.test(comment[valueEnd - 1]!)) {
      valueEnd -= 1
    }
    return { key, value: comment.slice(valueStart, valueEnd) }
  }
}

/** 仅解析文件级 lib 覆盖，保持上游每条注释首个配置与最后有效配置的语义。 */
export function resolveTemplateRefLib(baseLib: string, comments: readonly string[]): unknown {
  let lib: unknown = baseLib
  for (const comment of comments) {
    const directive = readCompilerDirective(comment)
    if (directive?.key !== 'lib') {
      continue
    }
    try {
      lib = JSON.parse(directive.value) as unknown
    }
    catch {
      // 与上游一致，忽略不是有效 JSON 的文件级配置。
    }
  }
  return lib
}

/** 在上游服务脚本生成后，用模块局部类型覆盖小程序原生 ref，避免修改浏览器全局声明。 */
export function createTemplateRefPlugin(baseLib: string): VueLanguagePluginReturn {
  return {
    name: '@weapp-vite/volar:template-ref',
    version: PLUGIN_VERSION,
    order: 1,
    resolveEmbeddedCode(_fileName, sfc, embeddedCode) {
      const match = SERVICE_SCRIPT_RE.exec(embeddedCode.id)
      if (!match || resolveTemplateRefLib(baseLib, sfc.comments) !== 'wevu') {
        return
      }
      // 保留上游的 SVG → HTML 合并顺序，再让小程序的同名 tag 优先。
      const declaration = match[1]!.startsWith('j')
        ? `/** @typedef {${LOCAL_ELEMENTS}} __VLS_Elements */`
        : `type __VLS_Elements = ${LOCAL_ELEMENTS};`
      embeddedCode.content.push(`\n${declaration}\n`)
    },
  }
}
