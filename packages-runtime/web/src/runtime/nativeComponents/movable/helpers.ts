export type MovableDirection = 'all' | 'horizontal' | 'vertical' | 'none'

export interface MovablePosition {
  x: number
  y: number
}

export interface MovableBounds {
  width: number
  height: number
  viewWidth: number
  viewHeight: number
}

export function resolveMovableDirection(value: string | null): MovableDirection {
  if (value === 'horizontal' || value === 'vertical' || value === 'none') {
    return value
  }
  return 'all'
}

export function resolveMovableNumber(value: string | null, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function clampMovablePosition(
  position: MovablePosition,
  bounds: MovableBounds,
  direction: MovableDirection,
  outOfBounds: boolean,
) {
  const next = { ...position }
  if (!outOfBounds) {
    next.x = Math.min(Math.max(0, next.x), Math.max(0, bounds.width - bounds.viewWidth))
    next.y = Math.min(Math.max(0, next.y), Math.max(0, bounds.height - bounds.viewHeight))
  }
  if (direction === 'horizontal' || direction === 'none') {
    next.y = position.y
  }
  if (direction === 'vertical' || direction === 'none') {
    next.x = position.x
  }
  return next
}
