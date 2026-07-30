import { normalizeViteId } from '../utils/viteId'

export const WEVU_RUNTIME_MODULE_IDS = [
  'wevu',
  'wevu/router',
  'wevu/store',
  'wevu/api',
  'wevu/fetch',
  'wevu/web-apis',
  'wevu/internal-runtime',
  'wevu/internal-reactivity',
  'wevu/internal-template',
] as const

export type WevuRuntimeModuleId = (typeof WEVU_RUNTIME_MODULE_IDS)[number]

export type WevuRuntimeModuleFamily
  = | 'api'
    | 'compiler'
    | 'fetch'
    | 'jsx-runtime'
    | 'reactivity'
    | 'router'
    | 'runtime'
    | 'store'
    | 'template'
    | 'vue-demi'
    | 'web-apis'

const WEVU_ENTRY_MODULE_IDS: Record<string, WevuRuntimeModuleId> = {
  'api': 'wevu/api',
  'fetch': 'wevu/fetch',
  'index': 'wevu',
  'internal-reactivity': 'wevu/internal-reactivity',
  'internal-runtime': 'wevu/internal-runtime',
  'internal-template': 'wevu/internal-template',
  'router': 'wevu/router',
  'store': 'wevu/store',
  'web-apis': 'wevu/web-apis',
}

const WEVU_STABLE_VENDOR_FILE_RE = /^weapp-vendors\/wevu-[^/]+\.js$/
const HASHED_MODULE_BASENAME_RE = /-[\w-]{8}$/

function isWevuEntryModulePath(value: string) {
  return Object.prototype.hasOwnProperty.call(WEVU_ENTRY_MODULE_IDS, value)
}

function normalizeModuleId(id: string) {
  return normalizeViteId(id, {
    stripQuery: true,
    fileProtocolToPath: true,
    stripAtFsPrefix: true,
    stripLeadingNullByte: true,
  }).replaceAll('\\', '/')
}

export function resolveWevuPreservedModulePath(id: string) {
  const normalized = normalizeModuleId(id)
  const sourceMarker = '/packages-runtime/wevu/src/'
  const distMarker = '/wevu/dist/'
  const sourceIndex = normalized.lastIndexOf(sourceMarker)
  if (sourceIndex >= 0) {
    const modulePath = normalized
      .slice(sourceIndex + sourceMarker.length)
      .replace(/\.[cm]?[jt]s$/, '')
    return modulePath
  }

  const distIndex = normalized.lastIndexOf(distMarker)
  if (distIndex < 0) {
    return undefined
  }
  const modulePath = normalized
    .slice(distIndex + distMarker.length)
    .replace(/^dev\//, '')
    .replace(/\.[cm]?[jt]s$/, '')
  if (
    !isWevuEntryModulePath(modulePath)
    && HASHED_MODULE_BASENAME_RE.test(modulePath)
  ) {
    return undefined
  }
  return modulePath
}

export function resolveWevuRuntimeModuleId(id: string): WevuRuntimeModuleId | undefined {
  if ((WEVU_RUNTIME_MODULE_IDS as readonly string[]).includes(id)) {
    return id as WevuRuntimeModuleId
  }

  const modulePath = resolveWevuPreservedModulePath(id)
  if (!modulePath || modulePath.includes('/')) {
    return undefined
  }
  return WEVU_ENTRY_MODULE_IDS[modulePath]
}

export function resolveWevuRuntimeModuleFamily(id: string): WevuRuntimeModuleFamily | undefined {
  const bareModuleId = resolveWevuRuntimeModuleId(id)
  if (bareModuleId) {
    if (bareModuleId === 'wevu/internal-reactivity') {
      return 'reactivity'
    }
    if (bareModuleId === 'wevu/internal-template') {
      return 'template'
    }
    if (bareModuleId === 'wevu/internal-runtime' || bareModuleId === 'wevu') {
      return 'runtime'
    }
    return bareModuleId.slice('wevu/'.length) as WevuRuntimeModuleFamily
  }

  const modulePath = resolveWevuPreservedModulePath(id)
  if (!modulePath) {
    return undefined
  }
  if (modulePath.startsWith('reactivity/') || modulePath === 'scheduler') {
    return 'reactivity'
  }
  if (modulePath === 'runtime/template') {
    return 'template'
  }
  if (modulePath.startsWith('router/') || modulePath.startsWith('routerInternal/')) {
    return 'router'
  }
  if (modulePath.startsWith('store/')) {
    return 'store'
  }
  if (modulePath.startsWith('compiler/')) {
    return 'compiler'
  }
  if (modulePath === 'jsx-runtime' || modulePath === 'vue-demi') {
    return modulePath
  }
  if (modulePath === 'api' || modulePath === 'fetch' || modulePath === 'web-apis') {
    return modulePath
  }
  return 'runtime'
}

export function resolveWevuStableVendorFileName(id: string) {
  const family = resolveWevuRuntimeModuleFamily(id)
  return family ? `weapp-vendors/wevu-${family}.js` : undefined
}

export function isWevuStableVendorFileName(fileName: string) {
  return WEVU_STABLE_VENDOR_FILE_RE.test(fileName.replaceAll('\\', '/'))
}
