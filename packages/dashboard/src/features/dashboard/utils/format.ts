export function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) {
    return '—'
  }

  const base = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= base && unitIndex < units.length - 1) {
    value /= base
    unitIndex++
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

export function formatPackageType(type: string) {
  switch (type) {
    case 'main':
      return '主包'
    case 'subPackage':
      return '分包'
    case 'independent':
      return '独立分包'
    case 'virtual':
      return '虚拟包'
    default:
      return type
  }
}

export function formatBuildOrigin(origin: string) {
  return origin === 'independent' ? '独立构建' : '主构建'
}

export function formatSourceType(type: string) {
  switch (type) {
    case 'src':
      return '业务源码'
    case 'workspace':
      return '工作区包'
    case 'plugin':
      return '插件'
    case 'node_modules':
      return '依赖'
    default:
      return type
  }
}
