import {
  normalizeFilePath,
  readFileSyncInternal,
  writeFileSyncInternal,
} from './files'

type AsyncSuccess = (options: unknown, result: { errMsg: string, [key: string]: unknown }) => unknown
type AsyncFailure = (options: unknown, errMsg: string) => unknown

interface FileWriteOptionsLike {
  filePath?: string
  data?: unknown
}

interface FileReadOptionsLike {
  filePath?: string
  encoding?: string
}

export function createFileSystemManagerBridge(
  callWxAsyncSuccess: AsyncSuccess,
  callWxAsyncFailure: AsyncFailure,
) {
  return {
    writeFile(options?: FileWriteOptionsLike) {
      const filePath = normalizeFilePath(options?.filePath)
      if (!filePath) {
        callWxAsyncFailure(options, 'writeFile:fail invalid filePath')
        return
      }
      try {
        writeFileSyncInternal(filePath, options?.data ?? '')
        callWxAsyncSuccess(options, { errMsg: 'writeFile:ok' })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        callWxAsyncFailure(options, `writeFile:fail ${message}`)
      }
    },
    readFile(options?: FileReadOptionsLike) {
      const filePath = normalizeFilePath(options?.filePath)
      if (!filePath) {
        callWxAsyncFailure(options, 'readFile:fail invalid filePath')
        return
      }
      try {
        const data = readFileSyncInternal(filePath, options?.encoding)
        callWxAsyncSuccess(options, { errMsg: 'readFile:ok', data })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        callWxAsyncFailure(options, `readFile:fail ${message}`)
      }
    },
    writeFileSync(filePath: string, data: string | ArrayBuffer | ArrayBufferView, _encoding?: string) {
      writeFileSyncInternal(filePath, data)
    },
    readFileSync(filePath: string, encoding?: string) {
      return readFileSyncInternal(filePath, encoding)
    },
  }
}
