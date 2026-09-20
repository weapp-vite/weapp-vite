export type WxsModuleBindings = Record<string, unknown>
export type LoadWxsModule = (filePath: string, inlineSource?: string) => unknown

export interface WxsModule {
  exports: any
}

const wxsFunctions = new WeakSet<object>()

function registerWxsExports(value: unknown, visited = new Set<unknown>()) {
  if (value == null || visited.has(value) || (typeof value !== 'object' && typeof value !== 'function')) {
    return
  }
  visited.add(value)
  if (typeof value === 'function') {
    wxsFunctions.add(value)
  }
  for (const exported of Object.values(value)) {
    registerWxsExports(exported, visited)
  }
}

export function callWxsFunction(fn: unknown, receiver: unknown, args: unknown[]) {
  if (typeof fn !== 'function' || !wxsFunctions.has(fn)) {
    return undefined
  }
  // WXS 接收视图层的数据副本，不能通过参数引用修改 AppService 数据。
  return Reflect.apply(fn, receiver, structuredClone(args))
}

export function wxsScopeData(scope: { data: Record<string, any>, wxs?: WxsModuleBindings }) {
  return scope.wxs ? { ...scope.data, ...scope.wxs } : scope.data
}

export function createWxsModuleLoader(options: {
  execute: (source: string, filePath: string, module: WxsModule, require: (request: string) => unknown) => void
  readSource: (filePath: string) => string | null | undefined
  resolvePath: (owner: string, request: string) => string
}) {
  const cache = new Map<string, WxsModule>()
  const load: LoadWxsModule = (filePath, inlineSource) => {
    const cached = cache.get(filePath)
    if (cached) {
      return cached.exports
    }
    const source = inlineSource ?? options.readSource(filePath)
    if (source == null) {
      throw new Error(`Missing WXS module: ${filePath}`)
    }
    const module: WxsModule = { exports: {} }
    cache.set(filePath, module)
    try {
      options.execute(source, filePath, module, (request) => {
        if (typeof request !== 'string' || !request.startsWith('.') || !request.endsWith('.wxs')) {
          throw new Error(`WXS require must reference a relative .wxs file: ${String(request)}`)
        }
        return load(options.resolvePath(filePath, request))
      })
      registerWxsExports(module.exports)
      return module.exports
    }
    catch (error) {
      cache.delete(filePath)
      throw error
    }
  }
  return { load, clear: () => cache.clear() }
}
