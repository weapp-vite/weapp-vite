const nativeNodes = new WeakMap<object, object>()

export function registerNativeComponentNode(host: object, node: object) {
  nativeNodes.set(host, node)
}

export function resolveNativeComponentNode(host: unknown) {
  if (!host || typeof host !== 'object') {
    return host
  }
  // 布局仍由宿主负责；可调用节点按宿主身份解析，避免相同 id 的不同作用域互相串用。
  return nativeNodes.get(host) ?? host
}
