import type { ChildNode } from 'postcss'
import postcss from 'postcss'

type StyleSignature
  = | ['comment', string]
    | ['decl', string, string, boolean]
    | ['rule', string, StyleSignature[]]
    | ['atrule', string, string, boolean, StyleSignature[]]

const CONTENT_HMR_NONCE = /^weapp-vite (?:compiler-content|tailwind-content) [^*\r\n]+$/

function stylesheetNodeSignature(node: ChildNode): StyleSignature[] {
  switch (node.type) {
    case 'comment':
      return CONTENT_HMR_NONCE.test(node.text.trim()) ? [] : [['comment', node.text]]
    case 'decl':
      return [['decl', node.prop, node.value, Boolean(node.important)]]
    case 'rule':
      return [['rule', node.selector, node.nodes.flatMap(stylesheetNodeSignature)]]
    case 'atrule':
      return [['atrule', node.name, node.params, node.nodes !== undefined, node.nodes?.flatMap(stylesheetNodeSignature) ?? []]]
  }
}

/** 比较完整样式语义及顺序，仅忽略格式信息和内容更新的受管 nonce 注释。 */
export function normalizeBenchmarkStylesheet(source: string): string {
  return JSON.stringify(postcss.parse(source).nodes.flatMap(stylesheetNodeSignature))
}
