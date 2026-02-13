interface WindowResizeSnapshot {
  size: {
    windowWidth: number
    windowHeight: number
  }
  windowWidth: number
  windowHeight: number
}

const windowResizeCallbacks = new Set<(result: WindowResizeSnapshot) => void>()
let windowResizeBridgeBound = false

function readWindowResizeResult(getWindowInfo: () => { windowWidth: number, windowHeight: number }) {
  const windowInfo = getWindowInfo()
  return {
    size: {
      windowWidth: windowInfo.windowWidth,
      windowHeight: windowInfo.windowHeight,
    },
    windowWidth: windowInfo.windowWidth,
    windowHeight: windowInfo.windowHeight,
  }
}

function notifyWindowResize(getWindowInfo: () => { windowWidth: number, windowHeight: number }) {
  if (windowResizeCallbacks.size === 0) {
    return
  }
  const result = readWindowResizeResult(getWindowInfo)
  for (const callback of windowResizeCallbacks) {
    callback(result)
  }
}

function bindWindowResizeBridge(getWindowInfo: () => { windowWidth: number, windowHeight: number }) {
  if (windowResizeBridgeBound) {
    return
  }
  windowResizeBridgeBound = true
  const runtimeTarget = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    addEventListener?: (type: string, listener: () => void) => void
  }
  runtimeTarget.addEventListener?.('resize', () => notifyWindowResize(getWindowInfo))
}

export function addWindowResizeCallback(
  callback: (result: WindowResizeSnapshot) => void,
  getWindowInfo: () => { windowWidth: number, windowHeight: number },
) {
  bindWindowResizeBridge(getWindowInfo)
  windowResizeCallbacks.add(callback)
}

export function removeWindowResizeCallback(callback?: (result: WindowResizeSnapshot) => void) {
  if (typeof callback !== 'function') {
    windowResizeCallbacks.clear()
    return
  }
  windowResizeCallbacks.delete(callback)
}
