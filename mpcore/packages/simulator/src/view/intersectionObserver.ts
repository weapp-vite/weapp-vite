import type {
  HeadlessWxCreateIntersectionObserverOption,
  HeadlessWxIntersectionObserver,
  HeadlessWxIntersectionObserverMargins,
  HeadlessWxIntersectionObserverObserveAllResult,
  HeadlessWxSelectorQueryBoundingClientRectResult,
  HeadlessWxWindowInfoResult,
} from '../host'
import { resolveSelectorQueryScopeRoot } from './selectorQuery'
import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface HeadlessIntersectionObserverScopeResolution {
  kind: 'component' | 'missing' | 'page'
  scopeId?: string
}

export interface HeadlessIntersectionObserverDriver {
  getWindowInfo: () => HeadlessWxWindowInfoResult
  renderCurrentPage: () => { root: DomNodeLike }
  resolveScope: (scope?: Record<string, any>) => HeadlessIntersectionObserverScopeResolution
}

type RelativeTarget
  = | { kind: 'selector', margins: HeadlessWxIntersectionObserverMargins, selector: string }
    | { kind: 'viewport', margins: HeadlessWxIntersectionObserverMargins }

const NUMERIC_LIKE_VALUE_RE = /-?\d+(?:\.\d+)?/

function normalizeMargins(margins?: HeadlessWxIntersectionObserverMargins): HeadlessWxIntersectionObserverMargins {
  return {
    bottom: Number(margins?.bottom) || 0,
    left: Number(margins?.left) || 0,
    right: Number(margins?.right) || 0,
    top: Number(margins?.top) || 0,
  }
}

function parseStyleDeclarations(styleValue?: string) {
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

function resolveRect(node: DomNodeLike): HeadlessWxSelectorQueryBoundingClientRectResult {
  const style = parseStyleDeclarations(node.attribs?.style)
  const left = parseNumericLikeValue(node.attribs?.['data-sim-left'] ?? style.left)
  const top = parseNumericLikeValue(node.attribs?.['data-sim-top'] ?? style.top)
  const width = parseNumericLikeValue(node.attribs?.['data-sim-width'] ?? style.width)
  const height = parseNumericLikeValue(node.attribs?.['data-sim-height'] ?? style.height)
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

function applyMargins(
  rect: HeadlessWxSelectorQueryBoundingClientRectResult,
  margins: HeadlessWxIntersectionObserverMargins,
) {
  const top = rect.top - (margins.top ?? 0)
  const left = rect.left - (margins.left ?? 0)
  const right = rect.right + (margins.right ?? 0)
  const bottom = rect.bottom + (margins.bottom ?? 0)
  return {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left),
  }
}

function intersectRects(
  source: HeadlessWxSelectorQueryBoundingClientRectResult,
  target: HeadlessWxSelectorQueryBoundingClientRectResult,
) {
  const left = Math.max(source.left, target.left)
  const top = Math.max(source.top, target.top)
  const right = Math.min(source.right, target.right)
  const bottom = Math.min(source.bottom, target.bottom)
  if (right <= left || bottom <= top) {
    return {
      bottom: top,
      height: 0,
      left,
      right: left,
      top,
      width: 0,
    }
  }
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  }
}

function resolveViewportRect(windowInfo: HeadlessWxWindowInfoResult) {
  return {
    bottom: windowInfo.windowHeight,
    height: windowInfo.windowHeight,
    left: 0,
    right: windowInfo.windowWidth,
    top: 0,
    width: windowInfo.windowWidth,
  }
}

export function createHeadlessIntersectionObserver(
  driver: HeadlessIntersectionObserverDriver,
  scope?: Record<string, any>,
  _options?: HeadlessWxCreateIntersectionObserverOption,
): HeadlessWxIntersectionObserver {
  let active = true
  let relativeTarget: RelativeTarget = {
    kind: 'viewport',
    margins: normalizeMargins(),
  }

  const resolveScopedRoot = () => {
    const scopeResolution = driver.resolveScope(scope)
    if (scopeResolution.kind === 'missing') {
      return null
    }
    const rendered = driver.renderCurrentPage()
    return scopeResolution.kind === 'component'
      ? resolveSelectorQueryScopeRoot(rendered.root, scopeResolution.scopeId)
      : rendered.root
  }

  const resolveTargetNode = (selector: string) => {
    const scopedRoot = resolveScopedRoot()
    if (!scopedRoot) {
      return null
    }
    return querySelectorAll(scopedRoot, selector)[0] ?? null
  }

  const resolveRelativeRect = () => {
    if (relativeTarget.kind === 'viewport') {
      return applyMargins(resolveViewportRect(driver.getWindowInfo()), relativeTarget.margins)
    }

    const relativeNode = resolveTargetNode(relativeTarget.selector)
    if (!relativeNode) {
      return null
    }
    return applyMargins(resolveRect(relativeNode), relativeTarget.margins)
  }

  return {
    disconnect() {
      active = false
    },
    observe(selector, callback) {
      if (!active) {
        return
      }
      const targetNode = resolveTargetNode(selector)
      const relativeRect = resolveRelativeRect()
      if (!targetNode || !relativeRect) {
        return
      }

      const boundingClientRect = resolveRect(targetNode)
      const intersectionRect = intersectRects(boundingClientRect, relativeRect)
      const targetArea = boundingClientRect.width * boundingClientRect.height
      const intersectionArea = intersectionRect.width * intersectionRect.height
      const result: HeadlessWxIntersectionObserverObserveAllResult = {
        boundingClientRect,
        id: targetNode.attribs?.id ?? '',
        intersectionRatio: targetArea > 0 ? intersectionArea / targetArea : 0,
        intersectionRect,
        relativeRect,
      }
      callback(result)
    },
    relativeTo(selector, margins) {
      relativeTarget = {
        kind: 'selector',
        margins: normalizeMargins(margins),
        selector,
      }
      return this
    },
    relativeToViewport(margins) {
      relativeTarget = {
        kind: 'viewport',
        margins: normalizeMargins(margins),
      }
      return this
    },
  }
}
