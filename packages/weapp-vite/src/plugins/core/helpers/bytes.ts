export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  const formatted = value.toFixed(precision).replace(/\.0+$/, '')
  return `${formatted} ${units[index]}`
}
