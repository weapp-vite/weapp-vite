export function getWxApi<T = unknown>(path: string): T | undefined {
  const segments = path.split('.')
  let current: any = wx
  for (const segment of segments) {
    if (!current) {
      return undefined
    }
    current = current[segment]
  }
  return current as T
}

export function hasWxApi(path: string) {
  return typeof getWxApi(path) === 'function'
}
