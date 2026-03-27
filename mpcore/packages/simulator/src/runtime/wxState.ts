import type {
  HeadlessWxDownloadFileOption,
  HeadlessWxDownloadFileSuccessResult,
  HeadlessWxGetNetworkTypeResult,
  HeadlessWxNetworkStatusChangeCallback,
  HeadlessWxNetworkStatusChangeResult,
  HeadlessWxNetworkType,
  HeadlessWxRequestOption,
  HeadlessWxRequestSuccessResult,
  HeadlessWxRequestTask,
  HeadlessWxSaveFileOption,
  HeadlessWxSaveFileSuccessResult,
  HeadlessWxShareMenuOption,
  HeadlessWxShowActionSheetOption,
  HeadlessWxShowActionSheetResult,
  HeadlessWxShowLoadingOption,
  HeadlessWxShowModalOption,
  HeadlessWxShowModalResult,
  HeadlessWxShowToastOption,
  HeadlessWxUploadFileOption,
  HeadlessWxUploadFileSuccessResult,
} from '../host'

export interface HeadlessWxLoadingSnapshot {
  mask: boolean
  title: string
}

export interface HeadlessWxToastSnapshot {
  duration: number
  icon: string
  mask: boolean
  title: string
}

export interface HeadlessWxNetworkSnapshot extends HeadlessWxNetworkStatusChangeResult {}

export interface HeadlessWxShareMenuSnapshot {
  isUpdatableMessage: boolean
  menus: string[]
  visible: boolean
  withShareTicket: boolean
}

export interface HeadlessWxActionSheetMockDefinition {
  cancel?: boolean
  tapIndex?: number
}

export interface HeadlessWxActionSheetLogEntry {
  itemList: string[]
  result?: HeadlessWxShowActionSheetResult
}

export interface HeadlessWxModalMockDefinition {
  cancel?: boolean
  confirm?: boolean
}

export interface HeadlessWxModalLogEntry {
  cancelColor: string
  cancelText: string
  confirmColor: string
  confirmText: string
  content: string
  result: HeadlessWxShowModalResult
  showCancel: boolean
  title: string
}

export interface HeadlessWxRequestMockDefinition {
  delay?: number
  header?: Record<string, string>
  method?: string
  response:
    | unknown
    | ((option: HeadlessWxRequestOption) => unknown)
  statusCode?: number
  url: RegExp | string
}

export interface HeadlessWxRequestLogEntry {
  data: unknown
  header: Record<string, string>
  matched: boolean
  method: string
  response?: HeadlessWxRequestSuccessResult
  url: string
}

export interface HeadlessWxDownloadFileMockDefinition {
  delay?: number
  fileContent:
    | string
    | ((option: HeadlessWxDownloadFileOption) => string)
  header?: Record<string, string>
  statusCode?: number
  url: RegExp | string
}

export interface HeadlessWxDownloadFileLogEntry {
  header: Record<string, string>
  matched: boolean
  response?: HeadlessWxDownloadFileSuccessResult
  tempFilePath?: string
  url: string
}

export interface HeadlessWxUploadFileMockDefinition {
  delay?: number
  header?: Record<string, string>
  method?: string
  response:
    | string
    | Partial<HeadlessWxUploadFileSuccessResult>
    | ((option: HeadlessWxUploadFileOption & { fileContent: string }) => string | Partial<HeadlessWxUploadFileSuccessResult>)
  statusCode?: number
  url: RegExp | string
}

export interface HeadlessWxUploadFileLogEntry {
  fileContent: string
  fileName?: string
  filePath: string
  formData: Record<string, unknown>
  header: Record<string, string>
  matched: boolean
  name: string
  response?: HeadlessWxUploadFileSuccessResult
  url: string
}

const STORAGE_LIMIT_SIZE = 10 * 1024
const DEFAULT_MODAL_CANCEL_COLOR = '#000000'
const DEFAULT_MODAL_CANCEL_TEXT = '取消'
const DEFAULT_MODAL_CONFIRM_COLOR = '#576B95'
const DEFAULT_MODAL_CONFIRM_TEXT = '确定'
const textEncoder = new TextEncoder()

function byteLength(input: string) {
  return textEncoder.encode(input).byteLength
}

function cloneShareMenuSnapshot(snapshot: HeadlessWxShareMenuSnapshot) {
  return {
    isUpdatableMessage: snapshot.isUpdatableMessage,
    menus: [...snapshot.menus],
    visible: snapshot.visible,
    withShareTicket: snapshot.withShareTicket,
  }
}

function createNetworkSnapshot(networkType: HeadlessWxNetworkType): HeadlessWxNetworkSnapshot {
  return {
    isConnected: networkType !== 'none',
    networkType,
  }
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeMethod(method?: string) {
  return (method || 'GET').trim().toUpperCase()
}

function isRequestSuccessResult(value: unknown): value is Partial<HeadlessWxRequestSuccessResult> & { data: unknown } {
  return !!value && typeof value === 'object' && 'data' in value
}

function matchesRequestMock(mock: HeadlessWxRequestMockDefinition, option: HeadlessWxRequestOption) {
  const requestMethod = normalizeMethod(option.method)
  const mockMethod = normalizeMethod(mock.method)
  if (mock.method && requestMethod !== mockMethod) {
    return false
  }

  if (typeof mock.url === 'string') {
    return mock.url === option.url
  }

  mock.url.lastIndex = 0
  return mock.url.test(option.url)
}

function resolveRequestResponse(
  mock: HeadlessWxRequestMockDefinition,
  option: HeadlessWxRequestOption,
): HeadlessWxRequestSuccessResult {
  const rawResponse = typeof mock.response === 'function'
    ? mock.response(option)
    : mock.response

  if (isRequestSuccessResult(rawResponse)) {
    return {
      cookies: Array.isArray(rawResponse.cookies) ? [...rawResponse.cookies] : [],
      data: cloneValue(rawResponse.data),
      errMsg: rawResponse.errMsg ?? 'request:ok',
      header: { ...rawResponse.header },
      statusCode: rawResponse.statusCode ?? mock.statusCode ?? 200,
    }
  }

  return {
    cookies: [],
    data: cloneValue(rawResponse),
    errMsg: 'request:ok',
    header: { ...(mock.header ?? {}) },
    statusCode: mock.statusCode ?? 200,
  }
}

function matchesSimpleUrlMock(
  mock: { url: RegExp | string },
  url: string,
) {
  if (typeof mock.url === 'string') {
    return mock.url === url
  }

  mock.url.lastIndex = 0
  return mock.url.test(url)
}

function resolveDownloadFileResponse(
  mock: HeadlessWxDownloadFileMockDefinition,
  option: HeadlessWxDownloadFileOption,
  tempFilePath: string,
): { fileContent: string, result: HeadlessWxDownloadFileSuccessResult } {
  const fileContent = typeof mock.fileContent === 'function'
    ? mock.fileContent(option)
    : mock.fileContent

  return {
    fileContent,
    result: {
      errMsg: 'downloadFile:ok',
      statusCode: mock.statusCode ?? 200,
      tempFilePath,
    },
  }
}

function resolveUploadFileResponse(
  mock: HeadlessWxUploadFileMockDefinition,
  option: HeadlessWxUploadFileOption,
  fileContent: string,
): HeadlessWxUploadFileSuccessResult {
  const rawResponse = typeof mock.response === 'function'
    ? mock.response({
        ...option,
        fileContent,
      })
    : mock.response

  if (typeof rawResponse === 'string') {
    return {
      data: rawResponse,
      errMsg: 'uploadFile:ok',
      statusCode: mock.statusCode ?? 200,
    }
  }

  return {
    data: rawResponse.data == null ? '' : String(rawResponse.data),
    errMsg: rawResponse.errMsg ?? 'uploadFile:ok',
    statusCode: rawResponse.statusCode ?? mock.statusCode ?? 200,
  }
}

function normalizeDelay(delay?: number) {
  return Number.isFinite(delay)
    ? Math.max(0, Math.trunc(delay ?? 0))
    : 0
}

function createNoopTask(): HeadlessWxRequestTask {
  return {
    abort() {},
  }
}

export function createHeadlessWxState() {
  const actionSheetLogs: HeadlessWxActionSheetLogEntry[] = []
  const actionSheetMocks: HeadlessWxActionSheetMockDefinition[] = []
  const downloadFileLogs: HeadlessWxDownloadFileLogEntry[] = []
  const downloadFileMocks: HeadlessWxDownloadFileMockDefinition[] = []
  const modalLogs: HeadlessWxModalLogEntry[] = []
  const networkStatusChangeCallbacks = new Set<HeadlessWxNetworkStatusChangeCallback>()
  const modalMocks: HeadlessWxModalMockDefinition[] = []
  const requestLogs: HeadlessWxRequestLogEntry[] = []
  const requestMocks: HeadlessWxRequestMockDefinition[] = []
  const storage = new Map<string, unknown>()
  const uploadFileLogs: HeadlessWxUploadFileLogEntry[] = []
  const uploadFileMocks: HeadlessWxUploadFileMockDefinition[] = []
  const files = new Map<string, string>()
  let fileId = 0
  let loading: HeadlessWxLoadingSnapshot | null = null
  let networkType: HeadlessWxNetworkType = 'wifi'
  let shareMenu: HeadlessWxShareMenuSnapshot = {
    isUpdatableMessage: false,
    menus: [],
    visible: false,
    withShareTicket: false,
  }
  let toast: HeadlessWxToastSnapshot | null = null

  const allocateFilePath = (bucket: 'saved' | 'temp', preferredPath?: string) => {
    if (typeof preferredPath === 'string' && preferredPath.trim()) {
      return preferredPath.trim()
    }
    fileId += 1
    return `headless://wxfile/${bucket}/${String(fileId).padStart(4, '0')}`
  }

  const runDelayedTask = <TResult>(
    delay: number,
    onSuccess: (result: TResult) => void,
    onFail: (error: Error) => void,
    abortMessage: string,
  ) => {
    if (delay <= 0) {
      onSuccess(undefined as TResult)
      return createNoopTask()
    }

    let completed = false
    const timer = setTimeout(() => {
      if (completed) {
        return
      }
      completed = true
      onSuccess(undefined as TResult)
    }, delay)

    return {
      abort() {
        if (completed) {
          return
        }
        completed = true
        clearTimeout(timer)
        onFail(new Error(abortMessage))
      },
    }
  }

  return {
    clearStorageSync() {
      storage.clear()
    },
    downloadFile(option: HeadlessWxDownloadFileOption): HeadlessWxRequestTask {
      const matchedMock = downloadFileMocks.find(mock => matchesSimpleUrlMock(mock, option.url))
      if (!matchedMock) {
        const logEntry: HeadlessWxDownloadFileLogEntry = {
          header: { ...(option.header ?? {}) },
          matched: false,
          url: option.url,
        }
        downloadFileLogs.push(logEntry)
        const error = new Error(`No downloadFile mock matched in headless runtime: ${option.url}`)
        option.fail?.(error)
        option.complete?.()
        return createNoopTask()
      }

      const tempFilePath = allocateFilePath('temp', option.filePath)
      const delay = normalizeDelay(matchedMock.delay)
      const logEntry: HeadlessWxDownloadFileLogEntry = {
        header: { ...(option.header ?? {}) },
        matched: true,
        response: {
          errMsg: 'downloadFile:ok',
          statusCode: matchedMock.statusCode ?? 200,
          tempFilePath,
        },
        tempFilePath,
        url: option.url,
      }

      const commit = () => {
        const { fileContent, result } = resolveDownloadFileResponse(matchedMock, option, tempFilePath)
        files.set(tempFilePath, fileContent)
        logEntry.response = { ...result }
        downloadFileLogs.push(logEntry)
        option.success?.(result)
        option.complete?.(result)
      }

      const fail = (error: Error) => {
        option.fail?.(error)
        option.complete?.()
      }

      if (delay <= 0) {
        commit()
        return createNoopTask()
      }

      return runDelayedTask(delay, commit, fail, 'downloadFile:fail abort')
    },
    getActionSheetLogs() {
      return actionSheetLogs.map(entry => ({
        ...entry,
        itemList: [...entry.itemList],
        result: entry.result ? { ...entry.result } : undefined,
      }))
    },
    getDownloadFileLogs() {
      return downloadFileLogs.map(entry => ({
        ...entry,
        header: { ...entry.header },
        response: entry.response ? { ...entry.response } : undefined,
      }))
    },
    getFileSnapshot() {
      return Object.fromEntries(files.entries())
    },
    getFileText(filePath: string) {
      return files.get(filePath) ?? null
    },
    getNetworkType(): HeadlessWxGetNetworkTypeResult {
      return {
        errMsg: 'getNetworkType:ok',
        networkType,
      }
    },
    getModalLogs() {
      return modalLogs.map(entry => ({
        ...entry,
        result: { ...entry.result },
      }))
    },
    getRequestLogs() {
      return requestLogs.map(entry => ({
        ...entry,
        data: cloneValue(entry.data),
        header: { ...entry.header },
        response: entry.response
          ? {
              ...entry.response,
              cookies: [...entry.response.cookies],
              data: cloneValue(entry.response.data),
              header: { ...entry.response.header },
            }
          : undefined,
      }))
    },
    getStorageInfoSync() {
      const keys = Array.from(storage.keys()).sort((a, b) => a.localeCompare(b))
      const totalBytes = Array.from(storage.entries()).reduce((sum, [key, value]) => {
        return sum + byteLength(JSON.stringify([key, value]))
      }, 0)
      return {
        currentSize: Math.ceil(totalBytes / 1024),
        errMsg: 'getStorageInfo:ok',
        keys,
        limitSize: STORAGE_LIMIT_SIZE,
      }
    },
    getStorageSnapshot() {
      return Object.fromEntries(
        Array.from(storage.entries(), ([key, value]) => [key, cloneValue(value)]),
      )
    },
    getStorageSync(key: string) {
      return cloneValue(storage.get(key))
    },
    getShareMenu() {
      return cloneShareMenuSnapshot(shareMenu)
    },
    getLoading() {
      return loading ? { ...loading } : null
    },
    hideShareMenu() {
      shareMenu = {
        ...shareMenu,
        visible: false,
      }
      return {
        errMsg: 'hideShareMenu:ok',
      }
    },
    getToast() {
      return toast ? { ...toast } : null
    },
    getUploadFileLogs() {
      return uploadFileLogs.map(entry => ({
        ...entry,
        formData: cloneValue(entry.formData),
        header: { ...entry.header },
        response: entry.response ? { ...entry.response } : undefined,
      }))
    },
    hideLoading() {
      loading = null
      return {
        errMsg: 'hideLoading:ok',
      }
    },
    hideToast() {
      toast = null
      return {
        errMsg: 'hideToast:ok',
      }
    },
    offNetworkStatusChange(callback?: HeadlessWxNetworkStatusChangeCallback) {
      if (!callback) {
        networkStatusChangeCallbacks.clear()
        return
      }
      networkStatusChangeCallbacks.delete(callback)
    },
    mockRequest(definition: HeadlessWxRequestMockDefinition) {
      requestMocks.push({
        ...definition,
        delay: definition.delay,
        header: definition.header ? { ...definition.header } : undefined,
      })
    },
    mockDownloadFile(definition: HeadlessWxDownloadFileMockDefinition) {
      downloadFileMocks.push({
        ...definition,
        delay: definition.delay,
        header: definition.header ? { ...definition.header } : undefined,
      })
    },
    mockModal(definition: HeadlessWxModalMockDefinition = {}) {
      modalMocks.push({
        cancel: definition.cancel,
        confirm: definition.confirm,
      })
    },
    mockUploadFile(definition: HeadlessWxUploadFileMockDefinition) {
      uploadFileMocks.push({
        ...definition,
        delay: definition.delay,
        header: definition.header ? { ...definition.header } : undefined,
      })
    },
    mockActionSheet(definition: HeadlessWxActionSheetMockDefinition = {}) {
      actionSheetMocks.push({
        cancel: definition.cancel,
        tapIndex: definition.tapIndex,
      })
    },
    onNetworkStatusChange(callback: HeadlessWxNetworkStatusChangeCallback) {
      networkStatusChangeCallbacks.add(callback)
    },
    removeStorageSync(key: string) {
      storage.delete(key)
    },
    request(option: HeadlessWxRequestOption): HeadlessWxRequestTask {
      const matchedMock = requestMocks.find(mock => matchesRequestMock(mock, option))
      if (!matchedMock) {
        const logEntry: HeadlessWxRequestLogEntry = {
          data: cloneValue(option.data),
          header: { ...(option.header ?? {}) },
          matched: false,
          method: normalizeMethod(option.method),
          url: option.url,
        }
        requestLogs.push(logEntry)
        const error = new Error(`No request mock matched in headless runtime: ${normalizeMethod(option.method)} ${option.url}`)
        option.fail?.(error)
        option.complete?.()
        return createNoopTask()
      }

      const response = resolveRequestResponse(matchedMock, option)
      const requestLogEntry: HeadlessWxRequestLogEntry = {
        data: cloneValue(option.data),
        header: { ...(option.header ?? {}) },
        matched: true,
        method: normalizeMethod(option.method),
        response,
        url: option.url,
      }
      const delay = Number.isFinite(matchedMock.delay)
        ? Math.max(0, Math.trunc(matchedMock.delay ?? 0))
        : 0

      if (delay <= 0) {
        requestLogs.push(requestLogEntry)
        option.success?.(response)
        option.complete?.(response)
        return createNoopTask()
      }

      return runDelayedTask(delay, () => {
        requestLogs.push(requestLogEntry)
        option.success?.(response)
        option.complete?.(response)
      }, (error) => {
        option.fail?.(error)
        option.complete?.()
      }, 'request:fail abort')
    },
    saveFile(option: HeadlessWxSaveFileOption): HeadlessWxSaveFileSuccessResult {
      const fileContent = files.get(option.tempFilePath)
      if (fileContent == null) {
        throw new Error(`saveFile:fail tempFilePath not found: ${option.tempFilePath}`)
      }

      const savedFilePath = allocateFilePath('saved', option.filePath)
      files.set(savedFilePath, fileContent)
      return {
        errMsg: 'saveFile:ok',
        savedFilePath,
      }
    },
    setStorageSync(key: string, value: unknown) {
      storage.set(key, cloneValue(value))
    },
    setFile(filePath: string, fileContent: string) {
      files.set(filePath, fileContent)
    },
    setNetworkType(nextNetworkType: HeadlessWxNetworkType) {
      networkType = nextNetworkType
      const snapshot = createNetworkSnapshot(networkType)
      networkStatusChangeCallbacks.forEach(callback => callback({ ...snapshot }))
      return {
        errMsg: 'getNetworkType:ok',
        networkType,
      }
    },
    showActionSheet(option: HeadlessWxShowActionSheetOption) {
      const itemList = Array.isArray(option.itemList)
        ? option.itemList.filter((item): item is string => typeof item === 'string')
        : []

      if (itemList.length === 0) {
        throw new Error('showActionSheet:fail invalid itemList')
      }

      const nextMock = actionSheetMocks.shift()
      if (nextMock?.cancel) {
        actionSheetLogs.push({
          itemList: [...itemList],
        })
        throw new Error('showActionSheet:fail cancel')
      }

      const tapIndex = Number.isInteger(nextMock?.tapIndex)
        ? Number(nextMock?.tapIndex)
        : 0

      if (tapIndex < 0 || tapIndex >= itemList.length) {
        throw new Error('showActionSheet:fail invalid tapIndex')
      }

      const result: HeadlessWxShowActionSheetResult = {
        errMsg: 'showActionSheet:ok',
        tapIndex,
      }

      actionSheetLogs.push({
        itemList: [...itemList],
        result: { ...result },
      })

      return result
    },
    showShareMenu(option: HeadlessWxShareMenuOption = {}) {
      shareMenu = {
        isUpdatableMessage: Boolean(option.isUpdatableMessage),
        menus: Array.isArray(option.menus)
          ? option.menus.filter((item): item is string => typeof item === 'string')
          : shareMenu.menus,
        visible: true,
        withShareTicket: Boolean(option.withShareTicket),
      }
      return {
        errMsg: 'showShareMenu:ok',
      }
    },
    showLoading(option: HeadlessWxShowLoadingOption) {
      loading = {
        mask: Boolean(option.mask),
        title: option.title,
      }
      return {
        errMsg: 'showLoading:ok',
      }
    },
    showModal(option: HeadlessWxShowModalOption) {
      const showCancel = option.showCancel !== false
      const nextMock = modalMocks.shift()
      let confirm = nextMock?.confirm ?? true
      let cancel = nextMock?.cancel ?? !confirm

      if (!showCancel) {
        confirm = true
        cancel = false
      }
      else if (confirm) {
        cancel = false
      }
      else {
        cancel = true
      }

      const result: HeadlessWxShowModalResult = {
        cancel,
        confirm,
        errMsg: 'showModal:ok',
      }

      modalLogs.push({
        cancelColor: option.cancelColor ?? DEFAULT_MODAL_CANCEL_COLOR,
        cancelText: option.cancelText ?? DEFAULT_MODAL_CANCEL_TEXT,
        confirmColor: option.confirmColor ?? DEFAULT_MODAL_CONFIRM_COLOR,
        confirmText: option.confirmText ?? DEFAULT_MODAL_CONFIRM_TEXT,
        content: option.content,
        result: { ...result },
        showCancel,
        title: option.title ?? '',
      })

      return result
    },
    showToast(option: HeadlessWxShowToastOption) {
      toast = {
        duration: Number(option.duration ?? 1500),
        icon: option.icon ?? 'success',
        mask: Boolean(option.mask),
        title: option.title,
      }
      return {
        errMsg: 'showToast:ok',
      }
    },
    uploadFile(option: HeadlessWxUploadFileOption): HeadlessWxRequestTask {
      const fileContent = files.get(option.filePath)
      if (fileContent == null) {
        const error = new Error(`uploadFile:fail file not found: ${option.filePath}`)
        option.fail?.(error)
        option.complete?.()
        return createNoopTask()
      }

      const matchedMock = uploadFileMocks.find(mock => matchesSimpleUrlMock(mock, option.url))
      const logEntry: HeadlessWxUploadFileLogEntry = {
        fileContent,
        fileName: option.fileName,
        filePath: option.filePath,
        formData: cloneValue(option.formData ?? {}),
        header: { ...(option.header ?? {}) },
        matched: Boolean(matchedMock),
        name: option.name,
        url: option.url,
      }

      if (!matchedMock) {
        uploadFileLogs.push(logEntry)
        const error = new Error(`No uploadFile mock matched in headless runtime: ${option.url}`)
        option.fail?.(error)
        option.complete?.()
        return createNoopTask()
      }

      const response = resolveUploadFileResponse(matchedMock, option, fileContent)
      const delay = normalizeDelay(matchedMock.delay)

      const commit = () => {
        logEntry.response = { ...response }
        uploadFileLogs.push(logEntry)
        option.success?.(response)
        option.complete?.(response)
      }

      const fail = (error: Error) => {
        option.fail?.(error)
        option.complete?.()
      }

      if (delay <= 0) {
        commit()
        return createNoopTask()
      }

      return runDelayedTask(delay, commit, fail, 'uploadFile:fail abort')
    },
    updateShareMenu(option: HeadlessWxShareMenuOption = {}) {
      shareMenu = {
        isUpdatableMessage: option.isUpdatableMessage == null
          ? shareMenu.isUpdatableMessage
          : Boolean(option.isUpdatableMessage),
        menus: Array.isArray(option.menus)
          ? option.menus.filter((item): item is string => typeof item === 'string')
          : shareMenu.menus,
        visible: true,
        withShareTicket: option.withShareTicket == null
          ? shareMenu.withShareTicket
          : Boolean(option.withShareTicket),
      }
      return {
        errMsg: 'updateShareMenu:ok',
      }
    },
  }
}
