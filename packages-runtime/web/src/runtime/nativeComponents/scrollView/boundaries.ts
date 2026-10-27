import type { ScrollPosition } from './helpers'
import { getRuntimeRpxSize } from '../../rpx'
import { readBooleanAttribute } from '../helpers'

const DEFAULT_SCROLL_THRESHOLD = 50
const THRESHOLD_VALUE_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(px|rpx)?$/i

/** 默认 50px；rpx 与运行时的设备视口和 designWidth 使用同一换算。 */
function resolveScrollThreshold(element: Element, name: string) {
  const raw = element.getAttribute(name)?.trim()
  if (!raw) {
    return DEFAULT_SCROLL_THRESHOLD
  }
  const match = raw.match(THRESHOLD_VALUE_RE)
  const numeric = match ? Number(match[1]) : Number.NaN
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_SCROLL_THRESHOLD
  }
  return match?.[2]?.toLowerCase() === 'rpx' ? numeric * getRuntimeRpxSize() : numeric
}

export function createScrollBoundaryTracker() {
  let boundaries = { top: false, bottom: false, left: false, right: false }
  return {
    reset() {
      boundaries = { top: false, bottom: false, left: false, right: false }
    },
    /** 按本轮尺寸重新判断上次位置，在业务回调前提交两轴状态。 */
    collect(element: Element, viewport: HTMLDivElement, previous: ScrollPosition) {
      const scrollY = readBooleanAttribute(element, 'scroll-y') && viewport.scrollHeight > viewport.clientHeight
      const scrollX = readBooleanAttribute(element, 'scroll-x') && viewport.scrollWidth > viewport.clientWidth
      const lowerThreshold = resolveScrollThreshold(element, 'lower-threshold')
      const upperThreshold = resolveScrollThreshold(element, 'upper-threshold')
      const bottom = viewport.scrollHeight - viewport.clientHeight - lowerThreshold
      const right = viewport.scrollWidth - viewport.clientWidth - lowerThreshold
      const current = {
        top: scrollY && viewport.scrollTop <= upperThreshold,
        bottom: scrollY && viewport.scrollTop >= bottom,
        left: scrollX && viewport.scrollLeft <= upperThreshold,
        right: scrollX && viewport.scrollLeft >= right,
      }
      const entered = {
        top: current.top && !(boundaries.top && previous.scrollTop <= upperThreshold),
        bottom: current.bottom && !(boundaries.bottom && previous.scrollTop >= bottom),
        left: current.left && !(boundaries.left && previous.scrollLeft <= upperThreshold),
        right: current.right && !(boundaries.right && previous.scrollLeft >= right),
      }
      boundaries = current
      const events: Array<[string, string]> = []
      if (entered.bottom || entered.right) {
        events.push(['scrolltolower', entered.right ? 'right' : 'bottom'])
      }
      if (entered.top || entered.left) {
        events.push(['scrolltoupper', entered.left ? 'left' : 'top'])
      }
      return events
    },
  }
}
