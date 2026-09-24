import type { TemplateNodeLike } from './templateRuntime'
import { parseDocument } from 'htmlparser2'
import { maskTemplateAttributes } from './templateAttributes'

const INLINE_WXS_RE = /<wxs\b([^>]*)(?<!\/)>([\s\S]*?)<\/wxs\s*>/g

export function parseWxsTemplateDocument(templateSource: string) {
  // WXS 内容按原始文本保存，避免 HTML tokenizer 把 JS 比较运算符或字符串解析为标签。
  const scripts: string[] = []
  const source = templateSource.replace(INLINE_WXS_RE, (_match, attributes: string, script: string) => {
    const index = scripts.push(script) - 1
    return `<wxs data-sim-wxs="${index}"${attributes}>wxs-source</wxs>`
  })
  const masked = maskTemplateAttributes(source)
  const document = parseDocument(`<page>${masked.source}</page>`, {
    xmlMode: false,
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
    recognizeSelfClosing: true,
  })
  if (!scripts.length && !masked.attributes.size) {
    return document
  }
  const restore = (node: TemplateNodeLike) => {
    if (masked.attributes.size && node.attribs) {
      for (const [name, token] of Object.entries(node.attribs)) {
        if (masked.attributes.has(token)) {
          node.attribs[name] = masked.attributes.get(token)!
        }
      }
    }
    if (node.name === 'wxs' && Object.hasOwn(node.attribs ?? {}, 'data-sim-wxs')) {
      node.children![0]!.data = scripts[Number(node.attribs!['data-sim-wxs'])]
      delete node.attribs!['data-sim-wxs']
    }
    for (const child of node.children ?? []) {
      restore(child)
    }
  }
  restore(document as unknown as TemplateNodeLike)
  return document
}
