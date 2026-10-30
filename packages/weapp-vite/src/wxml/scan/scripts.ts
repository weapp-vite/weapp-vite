import type { TemplateAttribute } from '@weapp-vite/language-service'
import { scanTemplate } from '@weapp-vite/language-service'

/** 掩码只供 XML parser 消费；脚本原文与属性范围继续使用共享词法结果。 */
export function createScriptScanSource(source: string) {
  const tokens = scanTemplate(source).tokens
  const tagAttributes = new Map<number, TemplateAttribute[]>()
  const chunks: string[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.kind === 'tag' && !token.closing) {
      tagAttributes.set(token.start, token.attributes)
    }
    else if (token.kind === 'script') {
      chunks.push(source.slice(cursor, token.start), source.slice(token.start, token.end).replace(/[^\r\n]/g, ' '))
      cursor = token.end
    }
  }
  chunks.push(source.slice(cursor))
  return { parserSource: chunks.join(''), tagAttributes }
}
