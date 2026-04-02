interface AdBaseOptions {
  adUnitId?: string
}

interface AdError {
  errMsg: string
  errCode: number
}

interface RewardedVideoAdCloseResult {
  isEnded: boolean
}

interface RewardedVideoAd {
  load: () => Promise<{ errMsg: string }>
  show: () => Promise<{ errMsg: string }>
  destroy: () => void
  onLoad: (callback: () => void) => void
  offLoad: (callback?: () => void) => void
  onError: (callback: (error: AdError) => void) => void
  offError: (callback?: (error: AdError) => void) => void
  onClose: (callback: (result: RewardedVideoAdCloseResult) => void) => void
  offClose: (callback?: (result: RewardedVideoAdCloseResult) => void) => void
}

interface InterstitialAd {
  load: () => Promise<{ errMsg: string }>
  show: () => Promise<{ errMsg: string }>
  destroy: () => void
  onLoad: (callback: () => void) => void
  offLoad: (callback?: () => void) => void
  onError: (callback: (error: AdError) => void) => void
  offError: (callback?: (error: AdError) => void) => void
  onClose: (callback: () => void) => void
  offClose: (callback?: () => void) => void
}

function createAdError(errMsg: string): AdError {
  return {
    errMsg,
    errCode: -1,
  }
}

function normalizeAdUnitId(options?: AdBaseOptions) {
  if (typeof options?.adUnitId !== 'string') {
    return ''
  }
  return options.adUnitId.trim()
}

export function createRewardedVideoAdImpl(options?: AdBaseOptions): RewardedVideoAd {
  let loaded = false
  let destroyed = false
  const loadCallbacks = new Set<() => void>()
  const errorCallbacks = new Set<(error: AdError) => void>()
  const closeCallbacks = new Set<(result: RewardedVideoAdCloseResult) => void>()
  const adUnitId = normalizeAdUnitId(options)

  const emitError = (error: AdError) => {
    for (const callback of errorCallbacks) {
      callback(error)
    }
  }

  const fail = (message: string) => {
    const error = createAdError(message)
    emitError(error)
    return Promise.reject(error)
  }

  return {
    load() {
      if (destroyed) {
        return fail('RewardedVideoAd.load:fail ad is destroyed')
      }
      if (!adUnitId) {
        return fail('RewardedVideoAd.load:fail invalid adUnitId')
      }
      loaded = true
      for (const callback of loadCallbacks) {
        callback()
      }
      return Promise.resolve({ errMsg: 'RewardedVideoAd.load:ok' })
    },
    show() {
      if (destroyed) {
        return fail('RewardedVideoAd.show:fail ad is destroyed')
      }
      if (!loaded) {
        return this.load().then(() => this.show())
      }
      const result: RewardedVideoAdCloseResult = { isEnded: true }
      for (const callback of closeCallbacks) {
        callback(result)
      }
      return Promise.resolve({ errMsg: 'RewardedVideoAd.show:ok' })
    },
    destroy() {
      destroyed = true
      loadCallbacks.clear()
      errorCallbacks.clear()
      closeCallbacks.clear()
    },
    onLoad(callback: () => void) {
      if (typeof callback === 'function') {
        loadCallbacks.add(callback)
      }
    },
    offLoad(callback?: () => void) {
      if (typeof callback !== 'function') {
        loadCallbacks.clear()
        return
      }
      loadCallbacks.delete(callback)
    },
    onError(callback: (error: AdError) => void) {
      if (typeof callback === 'function') {
        errorCallbacks.add(callback)
      }
    },
    offError(callback?: (error: AdError) => void) {
      if (typeof callback !== 'function') {
        errorCallbacks.clear()
        return
      }
      errorCallbacks.delete(callback)
    },
    onClose(callback: (result: RewardedVideoAdCloseResult) => void) {
      if (typeof callback === 'function') {
        closeCallbacks.add(callback)
      }
    },
    offClose(callback?: (result: RewardedVideoAdCloseResult) => void) {
      if (typeof callback !== 'function') {
        closeCallbacks.clear()
        return
      }
      closeCallbacks.delete(callback)
    },
  }
}

export function createInterstitialAdImpl(options?: AdBaseOptions): InterstitialAd {
  let loaded = false
  let destroyed = false
  const loadCallbacks = new Set<() => void>()
  const errorCallbacks = new Set<(error: AdError) => void>()
  const closeCallbacks = new Set<() => void>()
  const adUnitId = normalizeAdUnitId(options)

  const emitError = (error: AdError) => {
    for (const callback of errorCallbacks) {
      callback(error)
    }
  }

  const fail = (message: string) => {
    const error = createAdError(message)
    emitError(error)
    return Promise.reject(error)
  }

  return {
    load() {
      if (destroyed) {
        return fail('InterstitialAd.load:fail ad is destroyed')
      }
      if (!adUnitId) {
        return fail('InterstitialAd.load:fail invalid adUnitId')
      }
      loaded = true
      for (const callback of loadCallbacks) {
        callback()
      }
      return Promise.resolve({ errMsg: 'InterstitialAd.load:ok' })
    },
    show() {
      if (destroyed) {
        return fail('InterstitialAd.show:fail ad is destroyed')
      }
      if (!loaded) {
        return this.load().then(() => this.show())
      }
      for (const callback of closeCallbacks) {
        callback()
      }
      return Promise.resolve({ errMsg: 'InterstitialAd.show:ok' })
    },
    destroy() {
      destroyed = true
      loadCallbacks.clear()
      errorCallbacks.clear()
      closeCallbacks.clear()
    },
    onLoad(callback: () => void) {
      if (typeof callback === 'function') {
        loadCallbacks.add(callback)
      }
    },
    offLoad(callback?: () => void) {
      if (typeof callback !== 'function') {
        loadCallbacks.clear()
        return
      }
      loadCallbacks.delete(callback)
    },
    onError(callback: (error: AdError) => void) {
      if (typeof callback === 'function') {
        errorCallbacks.add(callback)
      }
    },
    offError(callback?: (error: AdError) => void) {
      if (typeof callback !== 'function') {
        errorCallbacks.clear()
        return
      }
      errorCallbacks.delete(callback)
    },
    onClose(callback: () => void) {
      if (typeof callback === 'function') {
        closeCallbacks.add(callback)
      }
    },
    offClose(callback?: () => void) {
      if (typeof callback !== 'function') {
        closeCallbacks.clear()
        return
      }
      closeCallbacks.delete(callback)
    },
  }
}
