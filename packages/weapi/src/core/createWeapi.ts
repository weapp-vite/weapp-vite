import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiResolvedTarget,
} from './types'
import { detectGlobalAdapter } from './adapter'
import { isSyntheticMethodSupported, resolveMethodMappingWithMeta } from './methodMapping'
import { createNotSupportedError, hasCallbacks, isPlainObject, shouldSkipPromise } from './utils'

const INTERNAL_KEYS = new Set<PropertyKey>([
  'setAdapter',
  'getAdapter',
  'platform',
  'raw',
  'resolveTarget',
  'supports',
])

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
  douyin: 'tt',
}

function normalizePlatformName(value?: string) {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
}

function resolveOptionsArg(args: unknown[]) {
  const nextArgs = args.slice()
  const lastArg = nextArgs.length > 0 ? nextArgs[nextArgs.length - 1] : undefined
  if (isPlainObject(lastArg)) {
    const options = { ...lastArg }
    nextArgs[nextArgs.length - 1] = options
    return { args: nextArgs, options }
  }
  const options: Record<string, any> = {}
  nextArgs.push(options)
  return { args: nextArgs, options }
}

function callWithPromise(
  context: WeapiAdapter,
  method: (...args: any[]) => any,
  args: unknown[],
  mapResult?: (result: any) => any,
) {
  return new Promise((resolve, reject) => {
    const { args: nextArgs, options } = resolveOptionsArg(args)
    let settled = false
    options.success = (res: any) => {
      settled = true
      resolve(mapResult ? mapResult(res) : res)
    }
    options.fail = (err: any) => {
      settled = true
      reject(err)
    }
    options.complete = (res: any) => {
      if (!settled) {
        resolve(mapResult ? mapResult(res) : res)
      }
    }
    try {
      method.apply(context, nextArgs)
    }
    catch (err) {
      reject(err)
    }
  })
}

function callMissingApi(methodName: string, platform: string | undefined, args: unknown[]) {
  const lastArg = args.length > 0 ? args[args.length - 1] : undefined
  const error = createNotSupportedError(methodName, platform)
  if (hasCallbacks(lastArg)) {
    lastArg.fail?.(error)
    lastArg.complete?.(error)
    return undefined
  }
  return Promise.reject(error)
}

/**
 * @description 创建跨平台 API 实例
 */
export function createWeapi<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter>(
  options: CreateWeapiOptions<TAdapter> = {},
): WeapiInstance<TAdapter> {
  let adapter: TAdapter | undefined = options.adapter
  let platformName: string | undefined = normalizePlatformName(options.platform)
  const allowFallback = options.strictCompatibility !== true
  const cache = new Map<PropertyKey, any>()
  const syntheticWindowResizeListeners = new Set<(result: any) => void>()
  let syntheticWindowResizeBridgeReady = false
  let syntheticWindowResizeSnapshot: string | undefined
  const syntheticMemoryWarningListeners = new Set<(result: any) => void>()
  let syntheticMemoryWarningBridgeReady = false
  const syntheticStorage = new Map<string, any>()
  const syntheticLogManager = {
    log: (..._args: unknown[]) => {},
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
    debug: (..._args: unknown[]) => {},
    setFilterMsg: (_msg: string) => {},
    addFilterMsg: (_msg: string) => {},
  }
  const syntheticVKSession = {
    start: () => Promise.resolve({ errMsg: 'VKSession.start:ok' }),
    stop: () => Promise.resolve({ errMsg: 'VKSession.stop:ok' }),
    destroy: () => {},
    addAnchors: () => Promise.resolve({ errMsg: 'VKSession.addAnchors:ok' }),
    removeAnchors: () => Promise.resolve({ errMsg: 'VKSession.removeAnchors:ok' }),
    clearAnchors: () => Promise.resolve({ errMsg: 'VKSession.clearAnchors:ok' }),
    hitTest: () => Promise.resolve([]),
    requestAnimationFrame: (_callback: (...args: any[]) => void) => 0,
    cancelAnimationFrame: (_id: number) => {},
  }
  const syntheticCameraContext = {
    takePhoto: (_options?: Record<string, any>) => Promise.resolve({
      tempImagePath: '',
      errMsg: 'takePhoto:ok',
    }),
    startRecord: (_options?: Record<string, any>) => Promise.resolve({
      errMsg: 'startRecord:ok',
    }),
    stopRecord: (_options?: Record<string, any>) => Promise.resolve({
      tempThumbPath: '',
      tempVideoPath: '',
      errMsg: 'stopRecord:ok',
    }),
    onCameraFrame: (_callback: (...args: any[]) => void) => {},
  }
  const syntheticNoopMethodSet = new Set([
    'addCard',
    'addFileToFavorites',
    'addPaymentPassFinish',
    'addPaymentPassGetCertificateData',
    'addPhoneCalendar',
    'addPhoneContact',
    'addPhoneRepeatCalendar',
    'addVideoToFavorites',
    'authorizeForMiniProgram',
    'authPrivateMessage',
    'bindEmployeeRelation',
    'canAddSecureElementPass',
    'canvasPutImageData',
    'checkDeviceSupportHevc',
    'checkEmployeeRelation',
    'checkIsAddedToMyMiniProgram',
    'checkIsOpenAccessibility',
    'checkIsPictureInPictureActive',
    'checkIsSoterEnrolledInDevice',
    'checkIsSupportSoterAuthentication',
    'openCard',
    'openChannelsActivity',
    'openChannelsEvent',
    'openChannelsLive',
    'openChannelsLiveNoticeInfo',
    'openChannelsUserProfile',
    'openChatTool',
    'openHKOfflinePayView',
    'openInquiriesTopic',
    'openOfficialAccountArticle',
    'openOfficialAccountChat',
    'openOfficialAccountProfile',
    'openPrivacyContract',
    'openSystemBluetoothSetting',
    'reportEvent',
    'reportMonitor',
    'reportPerformance',
  ])
  const syntheticCheckPayloadByMethod: Readonly<Record<string, Record<string, any>>> = {
    checkDeviceSupportHevc: { isSupport: false },
    checkEmployeeRelation: { isBound: false },
    checkIsAddedToMyMiniProgram: { added: false },
    checkIsOpenAccessibility: { openAccessibility: false },
    checkIsPictureInPictureActive: { active: false },
    checkIsSoterEnrolledInDevice: { isEnrolled: false },
    checkIsSupportSoterAuthentication: { supportMode: [] },
  }

  const mapSyntheticActionSheetResult = (result: any, itemList: readonly string[]) => {
    const hasSelection = itemList.length > 0
    const confirmed = Boolean(result?.confirm) && hasSelection
    const index = confirmed ? 0 : -1
    return {
      ...(isPlainObject(result) ? result : {}),
      index,
      tapIndex: index,
      cancel: !confirmed,
      errMsg: confirmed ? 'showActionSheet:ok' : 'showActionSheet:fail cancel',
    }
  }

  const resolveAdapter = () => {
    if (adapter) {
      return adapter
    }
    const detected = detectGlobalAdapter()
    if (detected.adapter) {
      adapter = detected.adapter as TAdapter
      platformName = platformName ?? normalizePlatformName(detected.platform)
    }
    return adapter
  }

  const setAdapter = (nextAdapter?: TAdapter, nextPlatform?: string) => {
    adapter = nextAdapter
    platformName = normalizePlatformName(nextPlatform)
    cache.clear()
  }

  const getAdapter = (): TAdapter | undefined => {
    if (!adapter) {
      resolveAdapter()
    }
    return adapter
  }

  const getPlatform = () => {
    if (!platformName) {
      resolveAdapter()
    }
    return platformName
  }

  const hasSyntheticSupport = (platform: string | undefined, methodName: string) => {
    if (platform !== 'my' && platform !== 'tt') {
      return false
    }
    return isSyntheticMethodSupported(platform, methodName)
  }

  const emitSyntheticWindowResize = (result: any) => {
    for (const listener of syntheticWindowResizeListeners) {
      listener(result)
    }
  }

  const emitSyntheticMemoryWarning = (result: any) => {
    for (const listener of syntheticMemoryWarningListeners) {
      listener(result)
    }
  }

  const ensureSyntheticWindowResizeBridge = () => {
    if (syntheticWindowResizeBridgeReady) {
      return
    }
    const runtimeAdapter = resolveAdapter() as Record<string, any> | undefined
    const onAppShow = runtimeAdapter?.onAppShow
    if (typeof onAppShow !== 'function') {
      return
    }
    syntheticWindowResizeBridgeReady = true
    onAppShow(() => {
      const currentAdapter = resolveAdapter() as Record<string, any> | undefined
      const getWindowInfo = currentAdapter?.getWindowInfo
      if (typeof getWindowInfo !== 'function') {
        return
      }
      getWindowInfo({
        success: (result: any) => {
          const nextSnapshot = JSON.stringify({
            pixelRatio: result?.pixelRatio,
            screenHeight: result?.screenHeight,
            screenWidth: result?.screenWidth,
            windowHeight: result?.windowHeight,
            windowWidth: result?.windowWidth,
          })
          if (syntheticWindowResizeSnapshot === undefined) {
            syntheticWindowResizeSnapshot = nextSnapshot
            return
          }
          if (syntheticWindowResizeSnapshot !== nextSnapshot) {
            syntheticWindowResizeSnapshot = nextSnapshot
            emitSyntheticWindowResize(result)
          }
        },
      })
    })
  }

  const ensureSyntheticMemoryWarningBridge = () => {
    if (syntheticMemoryWarningBridgeReady) {
      return
    }
    const runtimeAdapter = resolveAdapter() as Record<string, any> | undefined
    const onMemoryWarning = runtimeAdapter?.onMemoryWarning
    if (typeof onMemoryWarning !== 'function') {
      return
    }
    syntheticMemoryWarningBridgeReady = true
    onMemoryWarning((result: any) => {
      emitSyntheticMemoryWarning(result)
    })
  }

  const invokeSyntheticMethod = (
    platform: string | undefined,
    methodName: string,
    args: unknown[],
  ) => {
    if (!hasSyntheticSupport(platform, methodName)) {
      return {
        handled: false as const,
        result: undefined,
      }
    }
    const toArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []
    const resolveBatchSetEntries = (value: unknown) => {
      if (!isPlainObject(value)) {
        return []
      }
      const keyValueList = toArray<Record<string, any>>(value.keyValueList)
      if (keyValueList.length > 0) {
        return keyValueList
      }
      const dataList = toArray<Record<string, any>>(value.dataList)
      if (dataList.length > 0) {
        return dataList
      }
      return []
    }
    const resolveBatchGetKeys = (value: unknown) => {
      if (!isPlainObject(value)) {
        return []
      }
      const keyList = toArray<string>(value.keyList)
      if (keyList.length > 0) {
        return keyList.filter((item): item is string => typeof item === 'string')
      }
      const keys = toArray<string>(value.keys)
      return keys.filter((item): item is string => typeof item === 'string')
    }
    const invokeSyntheticAsyncSuccess = (payload: Record<string, any>) => {
      const lastArg = args.length > 0 ? args[args.length - 1] : undefined
      if (hasCallbacks(lastArg)) {
        lastArg.success?.(payload)
        lastArg.complete?.(payload)
        return undefined
      }
      return Promise.resolve(payload)
    }
    if (methodName === 'nextTick') {
      const callback = typeof args[0] === 'function' ? args[0] as () => void : undefined
      if (callback) {
        Promise.resolve().then(() => callback())
      }
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'showActionSheet' && platform === 'tt') {
      const runtimeAdapter = resolveAdapter() as Record<string, any> | undefined
      const showModal = runtimeAdapter?.showModal
      if (typeof showModal !== 'function') {
        return {
          handled: false as const,
          result: undefined,
        }
      }
      const lastArg = args.length > 0 ? args[args.length - 1] : undefined
      const originalOptions = isPlainObject(lastArg) ? lastArg as Record<string, any> : {}
      const itemList = Array.isArray(originalOptions.itemList)
        ? originalOptions.itemList.filter((item: unknown): item is string => typeof item === 'string')
        : []
      const content = itemList.length > 0
        ? itemList.map((item, index) => `${index + 1}. ${item}`).join('\n')
        : (typeof originalOptions.alertText === 'string' ? originalOptions.alertText : '')
      const modalOptions: Record<string, any> = {
        ...originalOptions,
        title: typeof originalOptions.title === 'string' && originalOptions.title
          ? originalOptions.title
          : '请选择操作',
        content,
        showCancel: true,
      }

      if (hasCallbacks(originalOptions)) {
        const originalSuccess = originalOptions.success
        const originalComplete = originalOptions.complete
        modalOptions.success = (result: any) => {
          originalSuccess?.(mapSyntheticActionSheetResult(result, itemList))
        }
        modalOptions.complete = (result: any) => {
          originalComplete?.(mapSyntheticActionSheetResult(result, itemList))
        }
        return {
          handled: true as const,
          result: showModal.call(runtimeAdapter, modalOptions),
        }
      }
      return {
        handled: true as const,
        result: callWithPromise(
          runtimeAdapter as WeapiAdapter,
          showModal,
          [modalOptions],
          (result: any) => mapSyntheticActionSheetResult(result, itemList),
        ),
      }
    }
    if (methodName === 'getLogManager') {
      return {
        handled: true as const,
        result: syntheticLogManager,
      }
    }
    if (methodName === 'createVKSession') {
      return {
        handled: true as const,
        result: syntheticVKSession,
      }
    }
    if (methodName === 'createCameraContext') {
      return {
        handled: true as const,
        result: syntheticCameraContext,
      }
    }
    if (methodName === 'cancelIdleCallback') {
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'canvasGetImageData') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          data: [],
          width: 0,
          height: 0,
          errMsg: 'canvasGetImageData:ok',
        }),
      }
    }
    if (Object.prototype.hasOwnProperty.call(syntheticCheckPayloadByMethod, methodName)) {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          ...syntheticCheckPayloadByMethod[methodName],
          errMsg: `${methodName}:ok`,
        }),
      }
    }
    if (syntheticNoopMethodSet.has(methodName)) {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: `${methodName}:ok`,
        }),
      }
    }
    if (methodName === 'reportAnalytics') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'reportAnalytics:ok',
        }),
      }
    }
    if (methodName === 'openCustomerServiceChat') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'openCustomerServiceChat:ok',
        }),
      }
    }
    if (methodName === 'compressVideo') {
      const options = isPlainObject(args[0]) ? args[0] : {}
      const source = typeof options.src === 'string' && options.src
        ? options.src
        : typeof options.tempFilePath === 'string' && options.tempFilePath
          ? options.tempFilePath
          : ''
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          ...options,
          tempFilePath: source,
          errMsg: 'compressVideo:ok',
        }),
      }
    }
    if (methodName === 'openVideoEditor') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'openVideoEditor:ok',
        }),
      }
    }
    if (methodName === 'getShareInfo') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          encryptedData: '',
          iv: '',
          errMsg: 'getShareInfo:ok',
        }),
      }
    }
    if (methodName === 'joinVoIPChat') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'joinVoIPChat:ok',
        }),
      }
    }
    if (methodName === 'openDocument' && platform === 'tt') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'openDocument:ok',
        }),
      }
    }
    if (methodName === 'batchSetStorage') {
      const options = isPlainObject(args[0]) ? args[0] : {}
      const entries = resolveBatchSetEntries(options)
      for (const entry of entries) {
        const key = typeof entry.key === 'string' ? entry.key : undefined
        if (!key) {
          continue
        }
        const data = Object.prototype.hasOwnProperty.call(entry, 'data') ? entry.data : entry.value
        syntheticStorage.set(key, data)
      }
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'batchSetStorage:ok',
        }),
      }
    }
    if (methodName === 'batchGetStorage') {
      const options = isPlainObject(args[0]) ? args[0] : {}
      const keyList = resolveBatchGetKeys(options)
      const dataList = keyList.map(key => ({
        key,
        data: syntheticStorage.get(key),
      }))
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          dataList,
          errMsg: 'batchGetStorage:ok',
        }),
      }
    }
    if (methodName === 'batchSetStorageSync') {
      const options = isPlainObject(args[0]) ? args[0] : {}
      const entries = resolveBatchSetEntries(options)
      for (const entry of entries) {
        const key = typeof entry.key === 'string' ? entry.key : undefined
        if (!key) {
          continue
        }
        const data = Object.prototype.hasOwnProperty.call(entry, 'data') ? entry.data : entry.value
        syntheticStorage.set(key, data)
      }
      return {
        handled: true as const,
        result: {
          errMsg: 'batchSetStorageSync:ok',
        },
      }
    }
    if (methodName === 'batchGetStorageSync') {
      const options = isPlainObject(args[0]) ? args[0] : {}
      const keyList = resolveBatchGetKeys(options)
      const dataList = keyList.map(key => ({
        key,
        data: syntheticStorage.get(key),
      }))
      return {
        handled: true as const,
        result: {
          dataList,
          errMsg: 'batchGetStorageSync:ok',
        },
      }
    }
    if (methodName === 'offMemoryWarning' && platform === 'tt') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticMemoryWarningListeners.delete(callback)
      }
      else {
        syntheticMemoryWarningListeners.clear()
      }
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'onMemoryWarning' && platform === 'tt') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticMemoryWarningListeners.add(callback)
      }
      ensureSyntheticMemoryWarningBridge()
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'onWindowResize' && platform === 'my') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticWindowResizeListeners.add(callback)
      }
      ensureSyntheticWindowResizeBridge()
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'offWindowResize' && platform === 'my') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticWindowResizeListeners.delete(callback)
      }
      else {
        syntheticWindowResizeListeners.clear()
      }
      return {
        handled: true as const,
        result: undefined,
      }
    }
    return {
      handled: false as const,
      result: undefined,
    }
  }

  const resolveTarget = (methodName: string): WeapiResolvedTarget => {
    const runtimeAdapter = resolveAdapter()
    const platform = getPlatform()
    const mappingInfo = resolveMethodMappingWithMeta(platform, methodName, { allowFallback })
    const target = mappingInfo?.target ?? methodName
    const targetMethod = runtimeAdapter
      ? (runtimeAdapter as Record<string, any>)[target]
      : undefined
    const supported = typeof targetMethod === 'function'
      || hasSyntheticSupport(platform, methodName)
    const supportLevel = !supported
      ? 'unsupported'
      : mappingInfo?.source === 'fallback'
        ? 'fallback'
        : mappingInfo?.source === 'explicit'
          ? 'mapped'
          : 'native'
    return {
      method: methodName,
      target,
      platform,
      mapped: target !== methodName,
      supported,
      supportLevel,
      semanticAligned: supportLevel === 'native' || supportLevel === 'mapped',
    }
  }

  const supports = (methodName: string, queryOptions: WeapiMethodSupportQueryOptions = {}) => {
    const resolved = resolveTarget(methodName)
    if (queryOptions.semantic === true) {
      return resolved.semanticAligned
    }
    return resolved.supported
  }

  const proxy = new Proxy({}, {
    get(_target, prop) {
      if (prop === Symbol.toStringTag) {
        return 'Weapi'
      }
      if (prop === 'then') {
        return undefined
      }
      if (INTERNAL_KEYS.has(prop)) {
        if (prop === 'setAdapter') {
          return setAdapter
        }
        if (prop === 'getAdapter') {
          return getAdapter
        }
        if (prop === 'platform') {
          return getPlatform()
        }
        if (prop === 'raw') {
          return getAdapter()
        }
        if (prop === 'resolveTarget') {
          return resolveTarget
        }
        if (prop === 'supports') {
          return supports
        }
      }

      if (cache.has(prop)) {
        return cache.get(prop)
      }

      const currentAdapter = resolveAdapter()
      if (!currentAdapter) {
        if (typeof prop !== 'string') {
          return undefined
        }
        return (...args: unknown[]) => callMissingApi(prop, getPlatform(), args)
      }

      const platform = getPlatform()
      const mappingRule = typeof prop === 'string'
        ? resolveMethodMappingWithMeta(platform, prop, { allowFallback })
        : undefined
      const methodName = mappingRule?.target ?? (prop as string)
      const value = (currentAdapter as Record<string, any>)[methodName]
      const syntheticSupported = typeof prop === 'string' && hasSyntheticSupport(platform, prop)
      if (typeof value !== 'function' && !syntheticSupported) {
        if (value === undefined && typeof prop === 'string') {
          const missing = (...args: unknown[]) => callMissingApi(prop, getPlatform(), args)
          cache.set(prop, missing)
          return missing
        }
        cache.set(prop, value)
        return value
      }

      const wrapped = (...args: unknown[]) => {
        const runtimeAdapter = resolveAdapter()
        const platform = getPlatform()
        const mappingInfo = resolveMethodMappingWithMeta(platform, prop as string, { allowFallback })
        const mappingRule = mappingInfo?.rule
        const methodName = mappingInfo?.target ?? (prop as string)
        const runtimeMethod = runtimeAdapter
          ? (runtimeAdapter as Record<string, any>)[methodName]
          : undefined
        const runtimeArgs = mappingRule?.mapArgs ? mappingRule.mapArgs(args) : args
        const preferSynthetic = platform === 'tt'
          && (prop === 'onMemoryWarning' || prop === 'offMemoryWarning')
        if (preferSynthetic) {
          const syntheticResult = invokeSyntheticMethod(platform, prop as string, runtimeArgs)
          if (syntheticResult.handled) {
            return syntheticResult.result
          }
        }
        if (typeof runtimeMethod !== 'function') {
          const syntheticResult = invokeSyntheticMethod(platform, prop as string, runtimeArgs)
          if (syntheticResult.handled) {
            return syntheticResult.result
          }
          return callMissingApi(prop as string, getPlatform(), args)
        }
        if (shouldSkipPromise(prop as string)) {
          const result = runtimeMethod.apply(runtimeAdapter, runtimeArgs)
          return mappingRule?.mapResult ? mappingRule.mapResult(result) : result
        }
        const lastArg = runtimeArgs.length > 0 ? runtimeArgs[runtimeArgs.length - 1] : undefined
        if (hasCallbacks(lastArg)) {
          if (mappingRule?.mapResult && isPlainObject(lastArg)) {
            const options = lastArg as Record<string, any>
            const originalSuccess = options.success
            const originalComplete = options.complete
            options.success = (res: any) => {
              originalSuccess?.(mappingRule.mapResult!(res))
            }
            options.complete = (res: any) => {
              originalComplete?.(mappingRule.mapResult!(res))
            }
          }
          const result = runtimeMethod.apply(runtimeAdapter, runtimeArgs)
          return mappingRule?.mapResult ? mappingRule.mapResult(result) : result
        }
        return callWithPromise(runtimeAdapter as WeapiAdapter, runtimeMethod, runtimeArgs, mappingRule?.mapResult)
      }
      cache.set(prop, wrapped)
      return wrapped
    },
  })

  return proxy as WeapiInstance<TAdapter>
}
