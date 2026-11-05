import type { CompilerError, ElementNode, ParserOptions, RootNode, TemplateChildNode } from '@vue/compiler-core'
import { advancePositionWithClone, NodeTypes } from '@vue/compiler-core'
import { parse } from '@vue/compiler-dom'
import { findScriptClosingTag } from '@weapp-vite/wxml/core'
import { presets } from '@weapp-vite/wxml/presets'

interface RawScriptModule {
  start: number
  bodyStart: number
  bodyEnd: number
  end: number
  placeholder: string
  source: string
}

export interface TemplateScriptModules {
  readonly byStart: ReadonlyMap<number, RawScriptModule>
  restore: (source: string) => string
}

const allRawTags = new Set(presets.flatMap(preset => preset.dialect.rawTags))
const rawTagCandidate = new RegExp(`<(?:${[...allRawTags].join('|')})(?:\\s|>)`, 'i')

function scriptTags(platform?: string) {
  return platform ? new Set(presets.find(preset => preset.id === platform)?.dialect.rawTags ?? ['wxs']) : allRawTags
}

function scriptBodyStart(source: string, start: number) {
  let quote = 0
  for (let offset = start; offset < source.length; offset++) {
    const code = source.charCodeAt(offset)
    if (quote) {
      if (code === quote) {
        quote = 0
      }
    }
    else if (code === 34 || code === 39) {
      quote = code
    }
    else if (code === 62) {
      return offset + 1
    }
  }
  return 0
}

function collectRawElements(root: RootNode, rawTags: ReadonlySet<string>) {
  const elements: ElementNode[] = []
  const visit = (nodes: TemplateChildNode[]) => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) {
        continue
      }
      // SVG filter 仍是普通元素；脚本 filter 必须声明模块或外部来源。
      const scriptFilter = node.tag !== 'filter' || node.props.some(prop => prop.type === NodeTypes.ATTRIBUTE && ['module', 'src'].includes(prop.name))
      if (rawTags.has(node.tag.toLowerCase()) && scriptFilter && !node.isSelfClosing) {
        elements.push(node)
      }
      visit(node.children)
    }
  }
  visit(root.children)
  return elements.sort((left, right) => left.loc.start.offset - right.loc.start.offset)
}

/** 脚本只交给共享 JS 词法边界扫描；Vue 仍负责标签、属性及模板归属。 */
export function parseTemplateWithScriptModules(
  source: string,
  options: ParserOptions,
  platform?: string,
  parser: typeof parse = parse,
) {
  const byStart = new Map<number, RawScriptModule>()
  const scripts: TemplateScriptModules = {
    byStart,
    restore(output) {
      for (const script of byStart.values()) {
        output = output.replaceAll(script.placeholder, () => script.source)
      }
      return output
    },
  }
  if (!rawTagCandidate.test(source)) {
    return { ast: parser(source, options), scripts }
  }

  let placeholderPrefix = 'wevu:raw-script:'
  while (source.includes(placeholderPrefix)) {
    placeholderPrefix += ':'
  }
  const rawTags = scriptTags(platform)
  let view = source
  let ast: RootNode
  while (true) {
    const errors: CompilerError[] = []
    ast = parser(view, { ...options, onError: error => errors.push(error) })
    let changed = false
    let cursor = 0
    // 每轮至少新增一个未处理起点，否则立即结束；有限源码保证扫描最终收敛。
    // Vue 确定元素归属；屏蔽正文后重新发现，防止伪 raw-text 标签遮住后续模块。
    for (const node of collectRawElements(ast, rawTags)) {
      const start = node.loc.start.offset
      if (start < cursor) {
        continue
      }
      const existing = byStart.get(start)
      if (existing) {
        cursor = existing.end
        continue
      }
      const bodyStart = scriptBodyStart(source, start + node.tag.length + 1)
      const closing = findScriptClosingTag(source, bodyStart, node.tag)
      if (!bodyStart || !closing) {
        throw new Error(`脚本标签 <${node.tag}> 缺少可确认的结束边界`)
      }
      byStart.set(start, {
        start,
        bodyStart,
        bodyEnd: closing.start,
        end: closing.end,
        placeholder: `<!--${placeholderPrefix}${byStart.size}-->`,
        source: source.slice(start, closing.end),
      })
      cursor = closing.end
      changed = true
    }
    if (!changed) {
      for (const error of errors) {
        if (!options.onError) {
          throw error
        }
        options.onError(error)
      }
      break
    }
    const chunks: string[] = []
    cursor = 0
    for (const script of [...byStart.values()].sort((left, right) => left.start - right.start)) {
      chunks.push(source.slice(cursor, script.bodyStart), source.slice(script.bodyStart, script.bodyEnd).replace(/[^\r\n]/g, ' '))
      cursor = script.bodyEnd
    }
    chunks.push(source.slice(cursor))
    view = chunks.join('')
  }
  if (!byStart.size) {
    return { ast, scripts }
  }
  ast.loc.source = source
  const restoreLocations = (nodes: TemplateChildNode[]) => {
    for (const node of nodes) {
      node.loc.source = source.slice(node.loc.start.offset, node.loc.end.offset)
      if (node.type !== NodeTypes.ELEMENT) {
        continue
      }
      if (node.innerLoc) {
        node.innerLoc.source = source.slice(node.innerLoc.start.offset, node.innerLoc.end.offset)
      }
      const script = byStart.get(node.loc.start.offset)
      if (script) {
        const content = source.slice(script.bodyStart, script.bodyEnd)
        const start = advancePositionWithClone(node.loc.start, source.slice(script.start, script.bodyStart))
        node.children = [{ type: NodeTypes.TEXT, content, loc: { start, end: advancePositionWithClone(start, content), source: content } }]
      }
      else {
        restoreLocations(node.children)
      }
    }
  }
  restoreLocations(ast.children)
  return { ast, scripts }
}
