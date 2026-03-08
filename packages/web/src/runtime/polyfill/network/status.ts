type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none'

interface NetworkStatusSnapshot {
  isConnected: boolean
  networkType: NetworkType
}

interface NavigatorConnection {
  type?: string
  effectiveType?: string
  addEventListener?: (type: string, listener: () => void) => void
}

export function getNavigatorConnection() {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    connection?: NavigatorConnection
    mozConnection?: NavigatorConnection
    webkitConnection?: NavigatorConnection
  }) | undefined
  return runtimeNavigator?.connection ?? runtimeNavigator?.mozConnection ?? runtimeNavigator?.webkitConnection
}

function resolveNetworkType(connection: NavigatorConnection | undefined, isConnected: boolean): NetworkType {
  if (!isConnected) {
    return 'none'
  }
  const type = typeof connection?.type === 'string' ? connection.type.toLowerCase() : ''
  const effectiveType = typeof connection?.effectiveType === 'string'
    ? connection.effectiveType.toLowerCase()
    : ''
  if (type.includes('wifi') || type.includes('ethernet')) {
    return 'wifi'
  }
  if (effectiveType.includes('5g')) {
    return '5g'
  }
  if (effectiveType.includes('4g')) {
    return '4g'
  }
  if (effectiveType.includes('3g')) {
    return '3g'
  }
  if (effectiveType.includes('2g') || effectiveType.includes('slow-2g')) {
    return '2g'
  }
  if (type.includes('cellular')) {
    return 'unknown'
  }
  return 'unknown'
}

export function readNetworkStatusSnapshot(): NetworkStatusSnapshot {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const isConnected = typeof runtimeNavigator?.onLine === 'boolean' ? runtimeNavigator.onLine : true
  const connection = getNavigatorConnection()
  return {
    isConnected,
    networkType: resolveNetworkType(connection, isConnected),
  }
}

const networkStatusCallbacks = new Set<(result: NetworkStatusSnapshot) => void>()
let networkStatusBridgeBound = false

function notifyNetworkStatusChange() {
  if (networkStatusCallbacks.size === 0) {
    return
  }
  const status = readNetworkStatusSnapshot()
  for (const callback of networkStatusCallbacks) {
    callback(status)
  }
}

function bindNetworkStatusBridge() {
  if (networkStatusBridgeBound) {
    return
  }
  networkStatusBridgeBound = true
  const runtimeTarget = globalThis as {
    addEventListener?: (type: string, listener: () => void) => void
  }
  runtimeTarget.addEventListener?.('online', notifyNetworkStatusChange)
  runtimeTarget.addEventListener?.('offline', notifyNetworkStatusChange)
  const connection = getNavigatorConnection()
  connection?.addEventListener?.('change', notifyNetworkStatusChange)
}

export function addNetworkStatusCallback(callback: (result: NetworkStatusSnapshot) => void) {
  bindNetworkStatusBridge()
  networkStatusCallbacks.add(callback)
}

export function removeNetworkStatusCallback(callback?: (result: NetworkStatusSnapshot) => void) {
  if (typeof callback !== 'function') {
    networkStatusCallbacks.clear()
    return
  }
  networkStatusCallbacks.delete(callback)
}
