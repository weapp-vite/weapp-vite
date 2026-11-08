import type { RenderNode, WxmlTagDiagnostic } from './types'
import { isHTMLTag, isMathMLTag, isSVGTag } from '@vue/shared'
import { isKnownUnsupportedNativeComponent, resolveNativeComponentWebTag } from '../../shared/nativeComponents'
import { TEMPLATE_IMPORT_TAG_NAMES, TEMPLATE_INCLUDE_TAG_NAMES } from '../../shared/wxml'
import { NATIVE_COMPONENT_NAMES } from './nativeTags'

const CONTROL_TAGS = new Set(['wxs', 'block', 'slot', 'template', 'page-meta', 'navigation-bar', ...TEMPLATE_IMPORT_TAG_NAMES, ...TEMPLATE_INCLUDE_TAG_NAMES])

/** 按真实注册和渲染能力分类，官方标签清单不代表已经实现 Web 语义。 */
export function classifyTemplateTag(name: string, componentTags?: Record<string, string>): WxmlTagDiagnostic['reason'] | undefined {
  const normalized = name.toLowerCase()
  const isRegistered = (tag: string) => componentTags
    && Object.hasOwn(componentTags, tag)
    && typeof componentTags[tag] === 'string'
    && Boolean(componentTags[tag])
  if (!normalized || isRegistered(name) || isRegistered(normalized) || CONTROL_TAGS.has(normalized) || resolveNativeComponentWebTag(normalized)) {
    return undefined
  }
  if (NATIVE_COMPONENT_NAMES.has(normalized) || isKnownUnsupportedNativeComponent(normalized)) {
    return 'unsupported'
  }
  return isHTMLTag(normalized) || isSVGTag(name) || isMathMLTag(normalized) ? undefined : 'unknown'
}

/** 收集原始节点的首次位置，标签诊断不改变渲染结果。 */
export function collectTagDiagnostics(nodes: RenderNode[], source: string, filename: string, componentTags?: Record<string, string>) {
  const diagnostics: WxmlTagDiagnostic[] = []
  const seen = new Set<string>()
  const lineStarts = [0]
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    lineStarts.push(match.index + match[0].length)
  }
  const visit = (children: RenderNode[]) => {
    for (const node of children) {
      if (node.type !== 'element') {
        continue
      }
      const reason = classifyTemplateTag(node.name, componentTags)
      if (reason && !seen.has(node.name)) {
        seen.add(node.name)
        const offset = node.startIndex
        let low = 0
        let high = lineStarts.length
        if (offset !== undefined) {
          while (low + 1 < high) {
            const middle = (low + high) >> 1
            if (lineStarts[middle] <= offset) {
              low = middle
            }
            else {
              high = middle
            }
          }
        }
        const line = offset === undefined ? undefined : low + 1
        diagnostics.push({ tag: node.name, reason, filename, line, column: offset === undefined ? undefined : offset - lineStarts[low] + 1 })
      }
      if (node.name !== 'wxs' && !(node.attribs?.src && (TEMPLATE_IMPORT_TAG_NAMES.includes(node.name) || TEMPLATE_INCLUDE_TAG_NAMES.includes(node.name)))) {
        visit(node.children ?? [])
      }
    }
  }
  visit(nodes)
  return diagnostics
}

/** 兼容已有内部收集器，未知标签与官方未实现组件分别处理。 */
export function collectUnknownTags(nodes: RenderNode[] | undefined, componentTags?: Record<string, string>, extraNodes: RenderNode[] = []) {
  return collectTagDiagnostics([...(nodes ?? []), ...extraNodes], '', '', componentTags)
    .filter(diagnostic => diagnostic.reason === 'unknown')
    .map(diagnostic => diagnostic.tag)
}

export function formatTagDiagnostic(diagnostic: WxmlTagDiagnostic) {
  const { filename, line, column, tag, reason } = diagnostic
  const location = `${filename}${line === undefined ? '' : `:${line}${column === undefined ? '' : `:${column}`}`}`
  return reason === 'unsupported'
    ? `[@weapp-vite/web] 小程序组件 <${tag}> 在 Web 端未实现完整语义（${location}）。请使用受支持的组件或提供 Web 替代实现。`
    : `[@weapp-vite/web] 未知标签 <${tag}>（${location}）：该标签既不是受支持的原生组件，也未在 usingComponents 注册。请检查拼写或补全组件注册。`
}

export function formatUnknownTagWarning(tags: string[], filename = '') {
  return tags.map(tag => formatTagDiagnostic({ tag, reason: 'unknown', filename })).join('\n')
}
