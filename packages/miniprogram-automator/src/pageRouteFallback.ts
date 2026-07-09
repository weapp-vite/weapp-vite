/**
 * @file 页面 route 降级查询工具。
 */
import type Connection from './Connection'
import Element from './Element'

interface RouteRenderedNode {
  id?: string
}

function normalizeFallbackIdPart(value: string) {
  return encodeURIComponent(value).replace(/%/g, '_')
}

function resolveFallbackTagName(selector: string) {
  const tagSelector = selector.trim()
  if (/^[a-z][\w-]*$/i.test(tagSelector)) {
    return tagSelector.toLowerCase()
  }
  return 'view'
}

/** 将 App-Service 查询到的渲染节点包装为 Element 兼容对象。 */
export function createRouteFallbackElement(
  connection: Connection,
  elementMap: Map<string, Element>,
  pageId: number,
  selector: string,
  node: RouteRenderedNode,
  index: number,
) {
  const nodeId = typeof node.id === 'string' && node.id
    ? normalizeFallbackIdPart(node.id)
    : String(index)
  const elementId = `__weapp_vite_route_fallback_${pageId}_${normalizeFallbackIdPart(selector)}_${nodeId}_${index}`
  return Element.create(connection, {
    elementId,
    pageId,
    tagName: resolveFallbackTagName(selector),
  }, elementMap)
}
