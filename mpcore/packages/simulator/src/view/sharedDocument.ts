import type { TemplateNodeLike } from './templateRuntime'
import { compileDialect, createParser, decodeAttribute } from '@weapp-vite/wxml/core'
import { weapp } from '@weapp-vite/wxml/presets'

interface SourceTemplateNode extends TemplateNodeLike {
  parent: SourceTemplateNode | null
  prev: SourceTemplateNode | null
  next: SourceTemplateNode | null
  children?: SourceTemplateNode[]
  attributeForms?: ReadonlySet<string>
}

interface SourceTemplateContainer extends SourceTemplateNode {
  children: SourceTemplateNode[]
}

interface SourceTemplateDocument extends SourceTemplateContainer {
  type: 'root'
}

// simulator 继续只执行可移植 WXS，不把兼容集合的其他标签当成脚本。
const parser = createParser(compileDialect(weapp.dialect), {
  resolveScriptBoundary: (_source, _start, _tag, candidates) => candidates.closingTag ?? candidates.commentClosings?.at(-1),
})

/** 元数据属于模板节点，普通 clone/spread 自动保留，不依赖外部 WeakMap。 */
export function sourceAttributeForms(node: object) {
  return (node as Partial<SourceTemplateNode>).attributeForms
}

/** 将共享源码树适配为 simulator 的逻辑模板树，不执行脚本或解析依赖。 */
export function parseSharedDocument(source: string, stripWhitespace = false): SourceTemplateDocument {
  const document = parser.parse(source)
  const fatal = document.diagnostics.find(item => item.severity === 'error')
  if (fatal) {
    throw new Error(`[simulator] ${fatal.start}: ${fatal.message}`)
  }
  const root: SourceTemplateDocument = { type: 'root', children: [], parent: null, prev: null, next: null }
  const stack: Array<{ input: typeof document.children, output: SourceTemplateContainer }> = [{ input: document.children, output: root }]
  while (stack.length) {
    const { input, output } = stack.pop()!
    for (const item of input) {
      if (stripWhitespace && item.kind === 'text' && /^[\t\r\n ]+$/.test(item.data)) {
        continue
      }
      const node: SourceTemplateNode = { type: item.kind === 'element' ? 'tag' : item.kind === 'script' ? 'text' : item.kind, parent: output, prev: output.children.at(-1) ?? null, next: null }
      if (node.prev) {
        node.prev.next = node
      }
      output.children.push(node)
      if (item.kind === 'element') {
        node.name = item.name
        node.attribs = {}
        node.children = []
        const forms = new Set<string>()
        for (const attribute of item.attributes) {
          if (!Object.hasOwn(node.attribs, attribute.name)) {
            node.attribs[attribute.name] = decodeAttribute(attribute.value ?? '', 'legacy', false, attribute.quote)
            if (attribute.value === undefined && Object.hasOwn(node.attribs, attribute.name)) {
              forms.add(attribute.name)
            }
          }
        }
        if (forms.size) {
          node.attributeForms = forms
        }
        stack.push({ input: item.children, output: node as SourceTemplateContainer })
      }
      else if (item.kind === 'cdata') {
        node.type = 'cdata'
        node.children = [{ type: 'text', data: item.data.slice(9, -3), parent: node, prev: null, next: null }]
      }
      else {
        node.data = item.kind === 'comment' ? item.data.slice(4, -3) : item.data
        if (item.kind === 'declaration') {
          node.type = 'directive'
          node.data = item.data.slice(1, item.data.endsWith('?>') ? -2 : -1)
          node.name = node.data.split(/\s/, 1)[0]
        }
      }
    }
  }
  return root
}

/** synthetic page 与静态纯空白过滤是 simulator 的渲染约定。 */
export function parseSharedWxsDocument(source: string) {
  return parseSharedDocument(`<page>${source}</page>`, true)
}
