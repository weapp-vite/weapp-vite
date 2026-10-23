import type { RenderNode } from './types'
import { isKnownUnsupportedNativeComponent, resolveNativeComponentWebTag } from '../../shared/nativeComponents'

/**
 * 小程序内置的非组件标签，允许出现在模板里。
 */
const BUILTIN_TAGS = new Set([
  'block',
  'slot',
  'template',
  'import',
  'include',
  'wxs',
])

/**
 * 允许直接写在 WXML 里的 HTML 标签。
 *
 * web 运行时会把未知标签原样透传成自定义元素，浏览器不认识时既不渲染也不报错，
 * 这里只做「明显不是小程序组件」的兜底，避免误报业务里刻意使用的 HTML 标签。
 */
const HTML_TAGS = new Set([
  'a',
  'article',
  'aside',
  'b',
  'br',
  'button',
  'code',
  'div',
  'em',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'input',
  'label',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'svg',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
])

function isKnownTag(name: string, componentTags?: Record<string, string>) {
  const normalized = name.toLowerCase()
  if (!normalized) {
    return true
  }
  if (componentTags?.[name] ?? componentTags?.[normalized]) {
    return true
  }
  if (BUILTIN_TAGS.has(normalized) || HTML_TAGS.has(normalized)) {
    return true
  }
  if (resolveNativeComponentWebTag(normalized)) {
    return true
  }
  // 已登记「web 端未实现」的原生组件属于已知缺口，不算拼写/注册错误。
  return isKnownUnsupportedNativeComponent(normalized)
}

function collectFromNodes(nodes: RenderNode[] | undefined, unknown: Set<string>) {
  for (const node of nodes ?? []) {
    if (node.type !== 'element') {
      continue
    }
    const name = node.name ?? ''
    if (name && !unknown.has(name) && !isKnownTag(name)) {
      unknown.add(name)
    }
    collectFromNodes(node.children, unknown)
  }
}

/**
 * 收集模板里既不是小程序内置组件、也没有对应自定义组件的标签。
 *
 * 这类标签在 web 端会被渲染成空的自定义元素，页面上一片空白但没有任何提示，
 * 是「组件名拼错」和「忘记在 usingComponents 注册」最常见的表现形式。
 */
export function collectUnknownTags(
  nodes: RenderNode[] | undefined,
  componentTags?: Record<string, string>,
  extraNodes: RenderNode[] = [],
) {
  const unknown = new Set<string>()
  collectFromNodes(nodes, unknown)
  collectFromNodes(extraNodes, unknown)
  return [...unknown].filter(name => !isKnownTag(name, componentTags))
}

export function formatUnknownTagWarning(tags: string[], filename?: string) {
  const location = filename ? ` (${filename})` : ''
  const list = tags.map(tag => `<${tag}>`).join('、')
  return `[web] 模板中使用了未知标签${location}：${list}。`
    + '它们既不是小程序内置组件，也不在 usingComponents 中，'
    + '浏览器不会渲染任何内容，请检查标签名拼写或组件注册。'
}
