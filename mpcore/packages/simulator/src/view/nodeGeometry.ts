import type { HeadlessWxSelectorQueryBoundingClientRectResult, HeadlessWxWindowInfoResult } from '../host'

interface GeometryNode {
  attribs?: Record<string, string>
  children?: GeometryNode[]
  data?: string
  name?: string
  parent?: GeometryNode | null
  type?: string
}

const NUMERIC_LIKE_VALUE_RE = /-?\d+(?:\.\d+)?/
const PIXEL_LENGTH_RE = /^\d+(?:\.\d+)?px$|^0$/

export function parseStyleDeclarations(styleValue?: string) {
  const declarations: Record<string, string> = {}
  if (!styleValue) {
    return declarations
  }

  for (const declaration of styleValue.split(';')) {
    const [rawProperty, ...rawValueParts] = declaration.split(':')
    const property = rawProperty?.trim()
    if (!property) {
      continue
    }
    declarations[property] = rawValueParts.join(':').trim()
  }

  return declarations
}

function parseNumericLikeValue(value?: string) {
  if (!value) {
    return 0
  }
  const match = value.match(NUMERIC_LIKE_VALUE_RE)
  return match ? Number(match[0]) : 0
}

export function resolveRect(node: GeometryNode, windowInfo?: HeadlessWxWindowInfoResult): HeadlessWxSelectorQueryBoundingClientRectResult {
  const style = parseStyleDeclarations(node.attribs?.style)
  const left = parseNumericLikeValue(node.attribs?.['data-sim-left'] ?? style.left)
  const top = parseNumericLikeValue(node.attribs?.['data-sim-top'] ?? style.top)
  const rawWidth = node.attribs?.['data-sim-width'] ?? style.width
  const rawHeight = node.attribs?.['data-sim-height'] ?? style.height
  const isTopLevelView = node.name === 'view' && node.parent?.name === 'page' && windowInfo?.windowWidth != null
  const width = rawWidth != null
    ? parseNumericLikeValue(rawWidth)
    : isTopLevelView && windowInfo
      ? windowInfo.windowWidth
      : 0
  const height = rawHeight != null
    ? parseNumericLikeValue(rawHeight)
    : isTopLevelView && windowInfo
      ? windowInfo.windowHeight
      : 0
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

/** 仅支持显式 px 视口和单个 view 内容盒；未知样式布局不作为已测量滚动范围。 */
export function resolveNativeScrollBounds(node: GeometryNode) {
  const viewport = parseStyleDeclarations(node.attribs?.style)
  let content: GeometryNode | undefined
  const visit = (parent: GeometryNode): boolean => {
    for (const child of parent.children ?? []) {
      if (child.type === 'comment' || (child.type === 'text' && !child.data?.trim())) {
        continue
      }
      // WXML block 只控制逻辑分组，不生成参与布局的内容盒。
      if (child.name === 'block') {
        if (!visit(child)) {
          return false
        }
      }
      else {
        if (content || child.name !== 'view') {
          return false
        }
        content = child
      }
    }
    return true
  }
  if (!visit(node)) {
    return { maxTop: 0, maxLeft: 0 }
  }
  const box = parseStyleDeclarations(content?.attribs?.style)
  const supported = content && !viewport.display && !box.display && !box.position && !box.transform
  const extent = (dimension: 'width' | 'height') => {
    const viewportValue = viewport[dimension]
    const contentValue = box[dimension]
    if (!supported || !viewportValue || !contentValue
      || !PIXEL_LENGTH_RE.test(viewportValue) || !PIXEL_LENGTH_RE.test(contentValue)) {
      return 0
    }
    const size = parseNumericLikeValue(viewportValue)
    const contentSize = parseNumericLikeValue(contentValue)
    return size > 0 && Number.isFinite(size) && Number.isFinite(contentSize)
      ? Math.max(0, contentSize - size)
      : 0
  }
  return { maxTop: extent('height'), maxLeft: extent('width') }
}
