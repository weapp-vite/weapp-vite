export type SwiperChangeSource = '' | 'autoplay' | 'touch'

export function clampSwiperIndex(index: number, itemCount: number) {
  if (itemCount <= 0) {
    return 0
  }
  return Math.min(itemCount - 1, Math.max(0, Math.trunc(index)))
}

export function resolveSwiperIndex(options: {
  current: number
  currentItemId?: string
  itemIds: string[]
}) {
  if (options.currentItemId) {
    const itemIndex = options.itemIds.indexOf(options.currentItemId)
    if (itemIndex >= 0) {
      return itemIndex
    }
  }
  return clampSwiperIndex(options.current, options.itemIds.length)
}

export function resolveSwiperStep(
  current: number,
  direction: -1 | 1,
  itemCount: number,
  circular: boolean,
) {
  if (itemCount <= 0) {
    return 0
  }
  const next = current + direction
  if (circular) {
    return (next + itemCount) % itemCount
  }
  return clampSwiperIndex(next, itemCount)
}

export function resolveSwipeTarget(options: {
  current: number
  delta: number
  itemSize: number
  itemCount: number
  circular: boolean
}) {
  const threshold = Math.max(24, options.itemSize * 0.2)
  if (Math.abs(options.delta) < threshold) {
    return options.current
  }
  return resolveSwiperStep(
    options.current,
    options.delta < 0 ? 1 : -1,
    options.itemCount,
    options.circular,
  )
}

export function createSwiperChangeDetail(
  current: number,
  currentItemId: string,
  source: SwiperChangeSource,
) {
  return {
    current,
    source,
    currentItemId,
  }
}

export function resolveSwiperNumber(
  value: string | null,
  fallback: number,
  minimum = 0,
) {
  if (value === null || value.trim() === '') {
    return fallback
  }
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(minimum, number) : fallback
}

export function resolveSwiperEasing(value: string | null) {
  switch (value?.trim()) {
    case 'linear':
      return 'linear'
    case 'easeInCubic':
      return 'cubic-bezier(0.55, 0.055, 0.675, 0.19)'
    case 'easeOutCubic':
      return 'cubic-bezier(0.215, 0.61, 0.355, 1)'
    case 'easeInOutCubic':
      return 'cubic-bezier(0.645, 0.045, 0.355, 1)'
    default:
      return 'ease'
  }
}

export function resolveSwiperLength(value: string | null) {
  const normalized = value?.trim() || '0px'
  const isRpx = /^-?\d+(?:\.\d+)?rpx$/i.test(normalized)
    || /^-?\.\d+rpx$/i.test(normalized)
  return isRpx ? `calc(var(--rpx) * ${normalized.slice(0, -3)})` : normalized
}
