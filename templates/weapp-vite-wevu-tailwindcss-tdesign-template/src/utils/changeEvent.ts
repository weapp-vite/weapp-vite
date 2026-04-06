type PrimitiveValue = string | number | boolean

function hasSameType<T extends PrimitiveValue>(value: unknown, fallback: T): value is T {
  return typeof value === typeof fallback
}

/**
 * @description 从小程序组件变更事件中提取值，兼容值直传、detail 直传和 detail.value 结构。
 */
export function resolveChangeValue<T extends PrimitiveValue>(event: unknown, fallback: T): T {
  if (hasSameType(event, fallback)) {
    return event
  }

  if (event && typeof event === 'object') {
    const payload = event as Record<string, any>
    if (hasSameType(payload.value, fallback)) {
      return payload.value
    }

    const detail = payload.detail
    if (hasSameType(detail, fallback)) {
      return detail
    }

    if (detail && typeof detail === 'object' && hasSameType(detail.value, fallback)) {
      return detail.value
    }
  }

  return fallback
}

/**
 * @description 从小程序组件变更事件中提取字符串值。
 */
export function resolveStringChangeValue(event: unknown, fallback = '') {
  return resolveChangeValue(event, fallback)
}

/**
 * @description 从小程序组件变更事件中提取数字值。
 */
export function resolveNumberChangeValue(event: unknown, fallback = 0) {
  return Number(resolveChangeValue(event, fallback))
}

/**
 * @description 从小程序组件变更事件中提取布尔值。
 */
export function resolveBooleanChangeValue(event: unknown, fallback = false) {
  return Boolean(resolveChangeValue(event, fallback))
}
