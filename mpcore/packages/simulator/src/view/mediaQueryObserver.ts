import type {
  HeadlessWxMediaQueryObserver,
  HeadlessWxMediaQueryObserverObserveCallbackResult,
  HeadlessWxObserveDescriptor,
  HeadlessWxWindowInfoResult,
} from '../host'

export interface HeadlessMediaQueryObserverDriver {
  getWindowInfo: () => HeadlessWxWindowInfoResult
}

export interface HeadlessMediaQueryObserverController {
  disconnect: () => void
  notify: () => void
  observer: HeadlessWxMediaQueryObserver
}

function resolveOrientation(windowInfo: HeadlessWxWindowInfoResult) {
  return windowInfo.windowWidth >= windowInfo.windowHeight
    ? 'landscape'
    : 'portrait'
}

function resolveMatches(
  descriptor: HeadlessWxObserveDescriptor,
  windowInfo: HeadlessWxWindowInfoResult,
) {
  if (descriptor.width != null && windowInfo.windowWidth !== descriptor.width) {
    return false
  }
  if (descriptor.minWidth != null && windowInfo.windowWidth < descriptor.minWidth) {
    return false
  }
  if (descriptor.maxWidth != null && windowInfo.windowWidth > descriptor.maxWidth) {
    return false
  }
  if (descriptor.height != null && windowInfo.windowHeight !== descriptor.height) {
    return false
  }
  if (descriptor.minHeight != null && windowInfo.windowHeight < descriptor.minHeight) {
    return false
  }
  if (descriptor.maxHeight != null && windowInfo.windowHeight > descriptor.maxHeight) {
    return false
  }
  if (descriptor.orientation != null && resolveOrientation(windowInfo) !== descriptor.orientation) {
    return false
  }
  return true
}

export function createHeadlessMediaQueryObserver(
  driver: HeadlessMediaQueryObserverDriver,
  onDisconnect?: () => void,
): HeadlessMediaQueryObserverController {
  let active = true
  let callback: ((result: HeadlessWxMediaQueryObserverObserveCallbackResult) => void) | undefined
  let descriptor: HeadlessWxObserveDescriptor | undefined
  let hasObserved = false
  let lastMatches: boolean | undefined

  const emit = (force: boolean) => {
    if (!active || !hasObserved || !callback || !descriptor) {
      return
    }

    const matches = resolveMatches(descriptor, driver.getWindowInfo())
    if (!force && lastMatches === matches) {
      return
    }

    lastMatches = matches
    callback({ matches })
  }

  const observer: HeadlessWxMediaQueryObserver = {
    disconnect() {
      if (!active) {
        return
      }
      active = false
      hasObserved = false
      callback = undefined
      descriptor = undefined
      onDisconnect?.()
    },
    observe(nextDescriptor, nextCallback) {
      if (!active) {
        return
      }
      descriptor = { ...nextDescriptor }
      callback = nextCallback
      hasObserved = true
      emit(true)
    },
  }

  return {
    disconnect: observer.disconnect,
    notify() {
      emit(false)
    },
    observer,
  }
}
