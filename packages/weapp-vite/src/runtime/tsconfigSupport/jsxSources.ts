type WevuJsxPlatform = 'weapp' | 'alipay' | 'tt' | string

const WEVU_JSX_IMPORT_SOURCES = new Set([
  'wevu',
  'wevu/alipay',
  'wevu/miniprogram',
  'wevu/tt',
  'wevu/weapp',
])

const JSX_RUNTIME_SUFFIX = '/jsx-runtime'

export function resolveWevuJsxImportSource(platform: WevuJsxPlatform | undefined) {
  switch (platform) {
    case undefined:
    case 'weapp':
      return 'wevu/weapp'
    case 'alipay':
      return 'wevu/alipay'
    case 'tt':
      return 'wevu/tt'
    default:
      return 'wevu'
  }
}

export function isWevuJsxImportSource(value: string | undefined): value is string {
  return Boolean(value && WEVU_JSX_IMPORT_SOURCES.has(value))
}

/**
 * `compilerOptions.types` 只按类型包目录解析，不能指向 Wevu JSX 子路径。
 */
export function isWevuJsxRuntimeTypePackage(value: string | undefined) {
  return Boolean(
    value?.endsWith(JSX_RUNTIME_SUFFIX)
    && isWevuJsxImportSource(value.slice(0, -JSX_RUNTIME_SUFFIX.length)),
  )
}
