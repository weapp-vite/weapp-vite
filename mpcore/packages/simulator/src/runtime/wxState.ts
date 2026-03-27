import type {
  HeadlessWxAccessFileOption,
  HeadlessWxAppendFileOption,
  HeadlessWxCopyFileOption,
  HeadlessWxDownloadFileOption,
  HeadlessWxDownloadFileSuccessResult,
  HeadlessWxFileSystemManager,
  HeadlessWxFileSystemResult,
  HeadlessWxGetNetworkTypeResult,
  HeadlessWxGetSavedFileInfoOption,
  HeadlessWxGetSavedFileInfoSuccessResult,
  HeadlessWxGetSavedFileListSuccessResult,
  HeadlessWxMkdirOption,
  HeadlessWxNetworkStatusChangeCallback,
  HeadlessWxNetworkStatusChangeResult,
  HeadlessWxNetworkType,
  HeadlessWxReadDirOption,
  HeadlessWxReadDirSuccessResult,
  HeadlessWxReadFileOption,
  HeadlessWxReadFileSuccessResult,
  HeadlessWxRemoveSavedFileOption,
  HeadlessWxRenameOption,
  HeadlessWxRequestOption,
  HeadlessWxRequestSuccessResult,
  HeadlessWxRequestTask,
  HeadlessWxRmdirOption,
  HeadlessWxSavedFileInfo,
  HeadlessWxSaveFileOption,
  HeadlessWxSaveFileSuccessResult,
  HeadlessWxShareMenuOption,
  HeadlessWxShowActionSheetOption,
  HeadlessWxShowActionSheetResult,
  HeadlessWxShowLoadingOption,
  HeadlessWxShowModalOption,
  HeadlessWxShowModalResult,
  HeadlessWxShowToastOption,
  HeadlessWxStatOption,
  HeadlessWxStats,
  HeadlessWxStatSuccessResult,
  HeadlessWxUnlinkOption,
  HeadlessWxUploadFileOption,
  HeadlessWxUploadFileSuccessResult,
  HeadlessWxWriteFileOption,
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
const TRAILING_SLASH_RE = /\/+$/
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

function normalizeEncoding(encoding?: string) {
  const normalized = (encoding ?? 'utf8').trim().toLowerCase()
  if (normalized === 'utf8' || normalized === 'utf-8') {
    return 'utf8'
  }
  throw new Error(`Unsupported file encoding in headless runtime: ${encoding}`)
}

function normalizeFsPath(input: string) {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('File path must be a non-empty string in headless runtime.')
  }
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.replace(TRAILING_SLASH_RE, '')
  }
  return trimmed
}

function splitFsPath(input: string) {
  const normalized = normalizeFsPath(input)
  const schemeIndex = normalized.indexOf('://')
  if (schemeIndex >= 0) {
    const afterScheme = schemeIndex + 3
    const firstSlash = normalized.indexOf('/', afterScheme)
    if (firstSlash < 0) {
      return {
        prefix: normalized,
        segments: [] as string[],
      }
    }
    return {
      prefix: normalized.slice(0, firstSlash),
      segments: normalized.slice(firstSlash + 1).split('/').filter(Boolean),
    }
  }

  const absolute = normalized.startsWith('/')
  return {
    prefix: absolute ? '/' : '',
    segments: normalized.split('/').filter(Boolean),
  }
}

function joinFsPath(prefix: string, segments: string[]) {
  if (segments.length === 0) {
    return prefix || '.'
  }
  if (!prefix) {
    return segments.join('/')
  }
  if (prefix === '/') {
    return `/${segments.join('/')}`
  }
  return `${prefix}/${segments.join('/')}`
}

function listParentDirectories(input: string) {
  const { prefix, segments } = splitFsPath(input)
  const parents: string[] = []
  if (segments.length === 0) {
    if (prefix && prefix !== '/') {
      parents.push(prefix)
    }
    return parents
  }

  for (let index = 0; index < segments.length; index += 1) {
    const parentPath = joinFsPath(prefix, segments.slice(0, index))
    if (parentPath !== '.' && parentPath !== '/') {
      parents.push(parentPath)
    }
  }
  return parents
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
  const savedFiles = new Map<string, HeadlessWxSavedFileInfo>()
  const directories = new Set<string>()
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

  const ensureDirectoryTree = (targetPath: string) => {
    for (const directoryPath of listParentDirectories(targetPath)) {
      directories.add(directoryPath)
    }
  }

  const createStats = (isDirectory: boolean, size: number): HeadlessWxStats => ({
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
    size,
  })

  const updateSavedFileMetadata = (normalizedPath: string, fileContent: string) => {
    const savedFile = savedFiles.get(normalizedPath)
    if (!savedFile) {
      return
    }
    savedFiles.set(normalizedPath, {
      ...savedFile,
      size: fileContent.length,
    })
  }

  const setSavedFileMetadata = (normalizedPath: string, fileContent: string, createTime = Date.now()) => {
    savedFiles.set(normalizedPath, {
      createTime,
      filePath: normalizedPath,
      size: fileContent.length,
    })
  }

  const accessFile = (filePath: string): HeadlessWxFileSystemResult => {
    const normalizedPath = normalizeFsPath(filePath)
    if (!files.has(normalizedPath) && !directories.has(normalizedPath)) {
      throw new Error(`access:fail no such file or directory, access '${normalizedPath}'`)
    }
    return {
      errMsg: 'access:ok',
    }
  }

  const readFile = (filePath: string, encoding?: string): HeadlessWxReadFileSuccessResult => {
    normalizeEncoding(encoding)
    const normalizedPath = normalizeFsPath(filePath)
    const fileContent = files.get(normalizedPath)
    if (fileContent == null) {
      throw new Error(`readFile:fail no such file or directory, open '${normalizedPath}'`)
    }
    return {
      data: fileContent,
      errMsg: 'readFile:ok',
    }
  }

  const writeFile = (filePath: string, data: string, encoding?: string): HeadlessWxFileSystemResult => {
    const normalizedPath = normalizeFsPath(filePath)
    normalizeEncoding(encoding)
    ensureDirectoryTree(normalizedPath)
    const fileContent = String(data)
    files.set(normalizedPath, fileContent)
    updateSavedFileMetadata(normalizedPath, fileContent)
    return {
      errMsg: 'writeFile:ok',
    }
  }

  const appendFile = (filePath: string, data: string, encoding?: string): HeadlessWxFileSystemResult => {
    const normalizedPath = normalizeFsPath(filePath)
    normalizeEncoding(encoding)
    ensureDirectoryTree(normalizedPath)
    const currentContent = files.get(normalizedPath) ?? ''
    const nextFileContent = `${currentContent}${String(data)}`
    files.set(normalizedPath, nextFileContent)
    updateSavedFileMetadata(normalizedPath, nextFileContent)
    return {
      errMsg: 'appendFile:ok',
    }
  }

  const copyFile = (srcPath: string, destPath: string): HeadlessWxFileSystemResult => {
    const normalizedSrcPath = normalizeFsPath(srcPath)
    const normalizedDestPath = normalizeFsPath(destPath)
    const fileContent = files.get(normalizedSrcPath)
    if (fileContent == null) {
      throw new Error(`copyFile:fail no such file or directory, copyfile '${normalizedSrcPath}'`)
    }
    ensureDirectoryTree(normalizedDestPath)
    files.set(normalizedDestPath, fileContent)
    if (savedFiles.has(normalizedDestPath)) {
      setSavedFileMetadata(
        normalizedDestPath,
        fileContent,
        savedFiles.get(normalizedDestPath)?.createTime ?? Date.now(),
      )
    }
    return {
      errMsg: 'copyFile:ok',
    }
  }

  const renameFile = (oldPath: string, newPath: string): HeadlessWxFileSystemResult => {
    const normalizedOldPath = normalizeFsPath(oldPath)
    const normalizedNewPath = normalizeFsPath(newPath)
    const fileContent = files.get(normalizedOldPath)
    if (fileContent == null) {
      throw new Error(`rename:fail no such file or directory, rename '${normalizedOldPath}'`)
    }
    files.delete(normalizedOldPath)
    const savedFile = savedFiles.get(normalizedOldPath)
    if (savedFile) {
      savedFiles.delete(normalizedOldPath)
    }
    ensureDirectoryTree(normalizedNewPath)
    files.set(normalizedNewPath, fileContent)
    if (savedFile) {
      savedFiles.set(normalizedNewPath, {
        ...savedFile,
        filePath: normalizedNewPath,
        size: fileContent.length,
      })
    }
    return {
      errMsg: 'rename:ok',
    }
  }

  const unlinkFile = (filePath: string): HeadlessWxFileSystemResult => {
    const normalizedPath = normalizeFsPath(filePath)
    if (!files.has(normalizedPath)) {
      throw new Error(`unlink:fail no such file or directory, unlink '${normalizedPath}'`)
    }
    files.delete(normalizedPath)
    savedFiles.delete(normalizedPath)
    return {
      errMsg: 'unlink:ok',
    }
  }

  const mkdir = (dirPath: string, recursive = false): HeadlessWxFileSystemResult => {
    const normalizedPath = normalizeFsPath(dirPath)
    if (!recursive) {
      const directParent = listParentDirectories(normalizedPath).at(-1)
      if (directParent && !directories.has(directParent)) {
        throw new Error(`mkdir:fail no such file or directory, mkdir '${normalizedPath}'`)
      }
    }
    for (const directoryPath of [...listParentDirectories(normalizedPath), normalizedPath]) {
      directories.add(directoryPath)
    }
    return {
      errMsg: 'mkdir:ok',
    }
  }

  const readdir = (dirPath: string): HeadlessWxReadDirSuccessResult => {
    const normalizedPath = normalizeFsPath(dirPath)
    if (!directories.has(normalizedPath)) {
      throw new Error(`readdir:fail no such file or directory, scandir '${normalizedPath}'`)
    }
    const { prefix, segments } = splitFsPath(normalizedPath)
    const baseDepth = segments.length
    const entries = new Set<string>()

    for (const directoryPath of directories) {
      if (directoryPath === normalizedPath) {
        continue
      }
      const current = splitFsPath(directoryPath)
      if (current.prefix !== prefix || current.segments.length <= baseDepth) {
        continue
      }
      if (current.segments.slice(0, baseDepth).join('/') !== segments.join('/')) {
        continue
      }
      entries.add(current.segments[baseDepth])
    }

    for (const filePath of files.keys()) {
      const current = splitFsPath(filePath)
      if (current.prefix !== prefix || current.segments.length <= baseDepth) {
        continue
      }
      if (current.segments.slice(0, baseDepth).join('/') !== segments.join('/')) {
        continue
      }
      entries.add(current.segments[baseDepth])
    }

    return {
      errMsg: 'readdir:ok',
      files: Array.from(entries).sort((a, b) => a.localeCompare(b)),
    }
  }

  const rmdir = (dirPath: string, recursive = false): HeadlessWxFileSystemResult => {
    const normalizedPath = normalizeFsPath(dirPath)
    if (files.has(normalizedPath)) {
      throw new Error(`rmdir:fail not a directory, rmdir '${normalizedPath}'`)
    }
    if (!directories.has(normalizedPath)) {
      throw new Error(`rmdir:fail no such file or directory, rmdir '${normalizedPath}'`)
    }

    const childDirectoryPaths = Array.from(directories)
      .filter(currentPath => currentPath !== normalizedPath && currentPath.startsWith(`${normalizedPath}/`))
    const childFilePaths = Array.from(files.keys())
      .filter(currentPath => currentPath.startsWith(`${normalizedPath}/`))

    if (!recursive && (childDirectoryPaths.length > 0 || childFilePaths.length > 0)) {
      throw new Error(`rmdir:fail directory not empty, rmdir '${normalizedPath}'`)
    }

    directories.delete(normalizedPath)
    childDirectoryPaths.forEach(currentPath => directories.delete(currentPath))
    childFilePaths.forEach((currentPath) => {
      files.delete(currentPath)
      savedFiles.delete(currentPath)
    })
    return {
      errMsg: 'rmdir:ok',
    }
  }

  const stat = (inputPath: string): HeadlessWxStatSuccessResult => {
    const normalizedPath = normalizeFsPath(inputPath)
    if (files.has(normalizedPath)) {
      return {
        errMsg: 'stat:ok',
        stats: createStats(false, files.get(normalizedPath)?.length ?? 0),
      }
    }
    if (directories.has(normalizedPath)) {
      return {
        errMsg: 'stat:ok',
        stats: createStats(true, 0),
      }
    }
    throw new Error(`stat:fail no such file or directory, stat '${normalizedPath}'`)
  }

  const getSavedFileList = (): HeadlessWxGetSavedFileListSuccessResult => {
    return {
      errMsg: 'getSavedFileList:ok',
      fileList: Array.from(savedFiles.values())
        .map(item => ({ ...item }))
        .sort((a, b) => a.filePath.localeCompare(b.filePath)),
    }
  }

  const getSavedFileInfo = (filePath: string): HeadlessWxGetSavedFileInfoSuccessResult => {
    const normalizedPath = normalizeFsPath(filePath)
    const savedFile = savedFiles.get(normalizedPath)
    if (!savedFile) {
      throw new Error(`getSavedFileInfo:fail no such file or directory, stat '${normalizedPath}'`)
    }
    return {
      createTime: savedFile.createTime,
      errMsg: 'getSavedFileInfo:ok',
      size: savedFile.size,
    }
  }

  const removeSavedFile = (filePath: string) => {
    const normalizedPath = normalizeFsPath(filePath)
    if (!savedFiles.has(normalizedPath)) {
      throw new Error(`removeSavedFile:fail no such file or directory, unlink '${normalizedPath}'`)
    }
    savedFiles.delete(normalizedPath)
    files.delete(normalizedPath)
    return {
      errMsg: 'removeSavedFile:ok',
    }
  }

  const fileSystemManager: HeadlessWxFileSystemManager = {
    access(option: HeadlessWxAccessFileOption) {
      try {
        const result = accessFile(option.path)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    accessSync(path: string) {
      accessFile(path)
    },
    appendFile(option: HeadlessWxAppendFileOption) {
      try {
        const result = appendFile(option.filePath, option.data, option.encoding)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    appendFileSync(filePath: string, data: string, encoding?: string) {
      appendFile(filePath, data, encoding)
    },
    copyFile(option: HeadlessWxCopyFileOption) {
      try {
        const result = copyFile(option.srcPath, option.destPath)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    copyFileSync(srcPath: string, destPath: string) {
      copyFile(srcPath, destPath)
    },
    mkdir(option: HeadlessWxMkdirOption) {
      try {
        const result = mkdir(option.dirPath, option.recursive)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    mkdirSync(dirPath: string, recursive?: boolean) {
      mkdir(dirPath, recursive)
    },
    readFile(option: HeadlessWxReadFileOption) {
      try {
        const result = readFile(option.filePath, option.encoding)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    readFileSync(filePath: string, encoding?: string) {
      return readFile(filePath, encoding).data
    },
    readdir(option: HeadlessWxReadDirOption) {
      try {
        const result = readdir(option.dirPath)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    readdirSync(dirPath: string) {
      return readdir(dirPath).files
    },
    rmdir(option: HeadlessWxRmdirOption) {
      try {
        const result = rmdir(option.dirPath, option.recursive)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    rmdirSync(dirPath: string, recursive?: boolean) {
      rmdir(dirPath, recursive)
    },
    rename(option: HeadlessWxRenameOption) {
      try {
        const result = renameFile(option.oldPath, option.newPath)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    renameSync(oldPath: string, newPath: string) {
      renameFile(oldPath, newPath)
    },
    stat(option: HeadlessWxStatOption) {
      try {
        const result = stat(option.path)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    statSync(path: string) {
      return stat(path).stats
    },
    unlink(option: HeadlessWxUnlinkOption) {
      try {
        const result = unlinkFile(option.filePath)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    unlinkSync(filePath: string) {
      unlinkFile(filePath)
    },
    writeFile(option: HeadlessWxWriteFileOption) {
      try {
        const result = writeFile(option.filePath, option.data, option.encoding)
        option.success?.(result)
        option.complete?.(result)
        return result
      }
      catch (error) {
        option.fail?.(error as Error)
        option.complete?.()
        return undefined
      }
    },
    writeFileSync(filePath: string, data: string, encoding?: string) {
      writeFile(filePath, data, encoding)
    },
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
        ensureDirectoryTree(tempFilePath)
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
    getDirectorySnapshot() {
      return Array.from(directories.values()).sort((a, b) => a.localeCompare(b))
    },
    getFileSystemManager() {
      return fileSystemManager
    },
    getSavedFileInfo(option: HeadlessWxGetSavedFileInfoOption) {
      return getSavedFileInfo(option.filePath)
    },
    getSavedFileList() {
      return getSavedFileList()
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
    removeSavedFile(option: HeadlessWxRemoveSavedFileOption) {
      return removeSavedFile(option.filePath)
    },
    saveFile(option: HeadlessWxSaveFileOption): HeadlessWxSaveFileSuccessResult {
      const fileContent = files.get(option.tempFilePath)
      if (fileContent == null) {
        throw new Error(`saveFile:fail tempFilePath not found: ${option.tempFilePath}`)
      }

      const savedFilePath = allocateFilePath('saved', option.filePath)
      ensureDirectoryTree(savedFilePath)
      files.set(savedFilePath, fileContent)
      setSavedFileMetadata(savedFilePath, fileContent)
      return {
        errMsg: 'saveFile:ok',
        savedFilePath,
      }
    },
    setStorageSync(key: string, value: unknown) {
      storage.set(key, cloneValue(value))
    },
    setFile(filePath: string, fileContent: string) {
      const normalizedPath = normalizeFsPath(filePath)
      ensureDirectoryTree(normalizedPath)
      files.set(normalizedPath, fileContent)
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
