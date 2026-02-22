const NATIVE_BRIDGE_MARKER = '__wevu_native_bridge__'

export function markNativeBridgeMethod(method: (...args: any[]) => any) {
  try {
    Object.defineProperty(method, NATIVE_BRIDGE_MARKER, {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(method as any)[NATIVE_BRIDGE_MARKER] = true
  }
}

export function isNativeBridgeMethod(method: unknown): method is (...args: any[]) => any {
  return typeof method === 'function' && Boolean((method as any)[NATIVE_BRIDGE_MARKER])
}
