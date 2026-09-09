import { DomUtils, parseDocument } from 'htmlparser2'
import postcss from 'postcss'

type MarkupNode = ReturnType<typeof parseDocument>['children'][number]

function normalizeMarkupNode(node: MarkupNode) {
  if ('attribs' in node && node.attribs.style && !node.attribs.style.includes('{{')) {
    const style = postcss.parse(`view {${node.attribs.style}}`).first
    if (style?.type === 'rule') {
      node.attribs.style = style.nodes.map(child => child.type === 'decl'
        ? `${child.prop}: ${child.value}${child.important ? ' !important' : ''}`
        : child.toString()).join('; ')
    }
  }
  if ('children' in node) {
    for (const child of node.children) {
      normalizeMarkupNode(child)
    }
  }
}

export function canonicalWxml(source: string) {
  const document = parseDocument(source, {
    xmlMode: true,
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
  })
  for (const child of document.children) {
    normalizeMarkupNode(child)
  }
  return DomUtils.getOuterHTML(document, { xmlMode: true, decodeEntities: false })
}

export function canonicalWxss(source: string) {
  const root = postcss.parse(source)
  root.raws = { after: '\n' }
  root.walk((node) => {
    node.raws = {}
    if (node.type === 'decl') {
      node.raws.between = node.value.trim() ? ': ' : ':'
    }
    if ('nodes' in node) {
      node.raws.semicolon = true
    }
  })
  return `${root.toString().trim()}\n`
}
