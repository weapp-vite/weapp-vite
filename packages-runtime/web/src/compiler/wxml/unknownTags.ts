import type { RenderNode } from './types'
import { isHTMLTag, isMathMLTag, isSVGTag } from '@vue/shared'
import { isKnownUnsupportedNativeComponent, resolveNativeComponentWebTag } from '../../shared/nativeComponents'
import { NATIVE_COMPONENT_NAMES } from './nativeTags'

const CONTROL_TAGS = new Set(['wxs'])

function isKnownTag(name: string, componentTags?: Record<string, string>) {
  const normalized = name.toLowerCase()
  if (!normalized || componentTags?.[name] || componentTags?.[normalized]) {
    return true
  }
  return CONTROL_TAGS.has(normalized)
    || NATIVE_COMPONENT_NAMES.has(normalized)
    || isHTMLTag(normalized)
    || isSVGTag(name)
    || isMathMLTag(normalized)
    || Boolean(resolveNativeComponentWebTag(normalized))
    || isKnownUnsupportedNativeComponent(normalized)
}

function collectFromNodes(nodes: RenderNode[] | undefined, unknown: Set<string>, componentTags?: Record<string, string>) {
  for (const node of nodes ?? []) {
    if (node.type !== 'element') {
      continue
    }
    const name = node.name ?? ''
    if (name && !isKnownTag(name, componentTags)) {
      unknown.add(name)
    }
    collectFromNodes(node.children, unknown, componentTags)
  }
}

/** 收集用户模板中可能拼写错误或尚未注册的标签，不改变渲染结果。 */
export function collectUnknownTags(
  nodes: RenderNode[] | undefined,
  componentTags?: Record<string, string>,
  extraNodes: RenderNode[] = [],
) {
  const unknown = new Set<string>()
  collectFromNodes(nodes, unknown, componentTags)
  collectFromNodes(extraNodes, unknown, componentTags)
  return [...unknown]
}

export function formatUnknownTagWarning(tags: string[], filename?: string) {
  const location = filename ? ` (${filename})` : ''
  const list = tags.map(tag => `<${tag}>`).join('、')
  return `[web] 模板中使用了未知标签${location}：${list}。`
    + '这些标签可能尚未在 usingComponents 中注册或存在拼写错误，请检查组件注册和标签名称。'
}
