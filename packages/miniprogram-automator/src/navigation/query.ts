/** 仅核对请求显式携带的参数，保留宿主附加参数及其原始编码形式。 */
export function matchesRouteQuery(actual: unknown, expected: Record<string, string>) {
  const expectedKeys = Object.keys(expected)
  if (!expectedKeys.length) {
    return true
  }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    return false
  }
  const query = actual as Record<string, unknown>
  return expectedKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(query, key) || query[key] == null) {
      return false
    }
    const value = String(query[key])
    if (value === expected[key]) {
      return true
    }
    try {
      return decodeURIComponent(value) === expected[key]
    }
    catch {
      return false
    }
  })
}
