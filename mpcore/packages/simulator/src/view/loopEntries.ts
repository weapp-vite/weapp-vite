export function resolveLoopEntries(value: unknown): Array<[string | number, unknown]> {
  if (Array.isArray(value)) {
    return value.map((item, index) => [index, item])
  }
  return value !== null && typeof value === 'object' ? Object.entries(value) : []
}
