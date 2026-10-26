import { readBooleanAttribute } from '../helpers'

/** 按原始 id 查找 light DOM，避免将引号、反斜杠等 id 内容拼入选择器。 */
export function findScrollTarget(element: Element) {
  const id = element.getAttribute('scroll-into-view')?.trim()
  return id ? [...element.querySelectorAll('[id]')].find(child => child.id === id) : undefined
}

function resolveDistance(start: number, size: number, viewportSize: number, alignment: string) {
  const end = start + size
  if (alignment === 'center') {
    return start - (viewportSize - size) / 2
  }
  if (alignment === 'end') {
    return end - viewportSize
  }
  if (alignment === 'nearest') {
    if ((start >= 0 && end <= viewportSize) || (start < 0 && end > viewportSize)) {
      return 0
    }
    return (start < 0) === (size <= viewportSize) ? start : end - viewportSize
  }
  return start
}

/** 仅调整启用的轴；默认 start，nearest 对已完整可见的目标保持位置。 */
export function scrollToTarget(element: Element, viewport: HTMLDivElement, target: Element) {
  const alignment = element.getAttribute('scroll-into-view-alignment') ?? 'start'
  const offsetValue = Number(element.getAttribute('scroll-into-view-offset'))
  const offset = Number.isFinite(offsetValue) ? offsetValue : 0
  const viewportRect = viewport.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const width = viewport.clientWidth || viewportRect.right - viewportRect.left
  const height = viewport.clientHeight || viewportRect.bottom - viewportRect.top
  if ((readBooleanAttribute(element, 'scroll-y') && height <= 0)
    || (readBooleanAttribute(element, 'scroll-x') && width <= 0)) {
    return false
  }
  const apply = (axis: 'x' | 'y') => {
    if (!readBooleanAttribute(element, `scroll-${axis}`)) {
      return
    }
    const vertical = axis === 'y'
    const start = vertical
      ? targetRect.top - viewportRect.top - viewport.clientTop
      : targetRect.left - viewportRect.left - viewport.clientLeft
    const size = vertical ? targetRect.bottom - targetRect.top : targetRect.right - targetRect.left
    const distance = resolveDistance(start, size, vertical ? height : width, alignment)
    if (alignment === 'nearest' && distance === 0) {
      return
    }
    if (vertical) {
      viewport.scrollTop = Math.max(0, viewport.scrollTop + distance - offset)
    }
    else {
      viewport.scrollLeft = Math.max(0, viewport.scrollLeft + distance - offset)
    }
  }
  apply('y')
  apply('x')
  return true
}
