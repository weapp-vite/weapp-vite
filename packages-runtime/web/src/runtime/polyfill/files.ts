export const WEB_USER_DATA_PATH = '/__weapp_vite_web_user_data__'

interface MemoryFileRecord {
  kind: 'text' | 'binary'
  text?: string
  bytes?: ArrayBuffer
}

const memoryFileStorage = new Map<string, MemoryFileRecord>()

export function normalizeFilePath(filePath: unknown) {
  if (typeof filePath !== 'string') {
    return ''
  }
  return filePath.trim()
}

function normalizeFileEncoding(encoding?: string) {
  if (typeof encoding !== 'string') {
    return ''
  }
  return encoding.trim().toLowerCase()
}

function cloneArrayBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

function toArrayBuffer(data: ArrayBuffer | ArrayBufferView) {
  if (data instanceof ArrayBuffer) {
    return cloneArrayBuffer(data)
  }
  const view = data as ArrayBufferView
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer
}

function decodeArrayBufferToText(buffer: ArrayBuffer, encoding?: string) {
  if (typeof TextDecoder === 'function') {
    try {
      return new TextDecoder(encoding || 'utf-8').decode(new Uint8Array(buffer))
    }
    catch {
      return new TextDecoder().decode(new Uint8Array(buffer))
    }
  }
  return Array.from(new Uint8Array(buffer))
    .map(byte => String.fromCharCode(byte))
    .join('')
}

export function writeFileSyncInternal(
  filePath: string,
  data: string | ArrayBuffer | ArrayBufferView,
) {
  const normalizedPath = normalizeFilePath(filePath)
  if (!normalizedPath) {
    throw new TypeError('writeFileSync:fail invalid filePath')
  }
  if (typeof data === 'string') {
    memoryFileStorage.set(normalizedPath, {
      kind: 'text',
      text: data,
    })
    return
  }
  memoryFileStorage.set(normalizedPath, {
    kind: 'binary',
    bytes: toArrayBuffer(data),
  })
}

export function readFileSyncInternal(filePath: string, encoding?: string) {
  const normalizedPath = normalizeFilePath(filePath)
  if (!normalizedPath) {
    throw new TypeError('readFileSync:fail invalid filePath')
  }
  const record = memoryFileStorage.get(normalizedPath)
  if (!record) {
    throw new TypeError(`readFileSync:fail no such file ${normalizedPath}`)
  }
  const normalizedEncoding = normalizeFileEncoding(encoding)
  if (record.kind === 'text') {
    return record.text ?? ''
  }
  const bytes = record.bytes ? cloneArrayBuffer(record.bytes) : new ArrayBuffer(0)
  if (normalizedEncoding) {
    return decodeArrayBufferToText(bytes, normalizedEncoding)
  }
  return bytes
}

export function resolveUploadFileName(filePath: string) {
  const normalized = filePath.split(/[?#]/)[0] ?? ''
  const segments = normalized.split('/')
  return segments[segments.length - 1] || 'file'
}

export async function resolveUploadFileBlob(
  filePath: string,
  runtimeFetch: typeof fetch | undefined,
) {
  const record = memoryFileStorage.get(filePath)
  if (record) {
    if (record.kind === 'text') {
      return new Blob([record.text ?? ''], { type: 'text/plain;charset=utf-8' })
    }
    return new Blob([record.bytes ?? new ArrayBuffer(0)])
  }
  if (/^(?:https?:|blob:|data:)/i.test(filePath) && runtimeFetch) {
    try {
      const response = await runtimeFetch(filePath, { method: 'GET' })
      return await response.blob()
    }
    catch {
      // fallback to plain text payload
    }
  }
  return new Blob([filePath], { type: 'text/plain;charset=utf-8' })
}

function cloneMemoryFileRecord(record: MemoryFileRecord): MemoryFileRecord {
  if (record.kind === 'text') {
    return {
      kind: 'text',
      text: record.text ?? '',
    }
  }
  return {
    kind: 'binary',
    bytes: record.bytes ? cloneArrayBuffer(record.bytes) : new ArrayBuffer(0),
  }
}

export function resolveSaveFilePath(tempFilePath: string, customPath?: string) {
  const targetPath = typeof customPath === 'string' ? customPath.trim() : ''
  if (targetPath) {
    return targetPath
  }
  return `${WEB_USER_DATA_PATH}/${resolveUploadFileName(tempFilePath)}`
}

export function saveMemoryFile(tempFilePath: string, savedFilePath: string) {
  const sourceRecord = memoryFileStorage.get(tempFilePath)
  if (sourceRecord) {
    memoryFileStorage.set(savedFilePath, cloneMemoryFileRecord(sourceRecord))
    return
  }
  memoryFileStorage.set(savedFilePath, {
    kind: 'text',
    text: tempFilePath,
  })
}

export function resolveOpenDocumentUrl(filePath: string) {
  const record = memoryFileStorage.get(filePath)
  const runtimeUrl = (globalThis as {
    URL?: {
      createObjectURL?: (value: unknown) => string
    }
  }).URL

  if (record) {
    if (record.kind === 'text') {
      const text = record.text ?? ''
      if (typeof Blob === 'function' && runtimeUrl?.createObjectURL) {
        return runtimeUrl.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
      }
      return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
    }
    const bytes = record.bytes ?? new ArrayBuffer(0)
    if (typeof Blob === 'function' && runtimeUrl?.createObjectURL) {
      return runtimeUrl.createObjectURL(new Blob([bytes]))
    }
    return ''
  }

  if (/^(?:https?:|blob:|data:)/i.test(filePath)) {
    return filePath
  }
  try {
    const runtimeLocation = (typeof location !== 'undefined' ? location : undefined) as { href?: string } | undefined
    if (runtimeLocation?.href) {
      return new URL(filePath, runtimeLocation.href).toString()
    }
  }
  catch {
    // fallback to raw filePath
  }
  return filePath
}
