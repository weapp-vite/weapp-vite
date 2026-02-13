const WEB_STORAGE_PREFIX = '__weapp_vite_web_storage__:'
const WEB_STORAGE_LIMIT_SIZE_KB = 10240
const memoryStorage = new Map<string, any>()

function getRuntimeStorage() {
  if (typeof localStorage === 'undefined') {
    return undefined
  }
  return localStorage
}

function storageKeyWithPrefix(key: string) {
  return `${WEB_STORAGE_PREFIX}${key}`
}

function encodeStorageValue(value: any) {
  if (value === undefined) {
    return JSON.stringify({ type: 'undefined' })
  }
  return JSON.stringify({ type: 'json', value })
}

function decodeStorageValue(value: string) {
  try {
    const parsed = JSON.parse(value) as { type?: string, value?: any }
    if (parsed?.type === 'undefined') {
      return undefined
    }
    if (parsed?.type === 'json') {
      return parsed.value
    }
    return parsed
  }
  catch {
    return value
  }
}

export function normalizeStorageKey(key: unknown) {
  if (typeof key !== 'string') {
    return ''
  }
  return key.trim()
}

export function hasStorageKey(key: string) {
  if (memoryStorage.has(key)) {
    return true
  }
  const storage = getRuntimeStorage()
  if (!storage) {
    return false
  }
  return storage.getItem(storageKeyWithPrefix(key)) !== null
}

function listStorageKeys() {
  const keySet = new Set<string>(memoryStorage.keys())
  const storage = getRuntimeStorage()
  if (!storage) {
    return Array.from(keySet)
  }
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(WEB_STORAGE_PREFIX)) {
      keySet.add(key.slice(WEB_STORAGE_PREFIX.length))
    }
  }
  return Array.from(keySet)
}

export function setStorageSyncInternal(key: string, data: any) {
  memoryStorage.set(key, data)
  const storage = getRuntimeStorage()
  if (storage) {
    storage.setItem(storageKeyWithPrefix(key), encodeStorageValue(data))
  }
}

export function getStorageSyncInternal(key: string) {
  if (memoryStorage.has(key)) {
    return memoryStorage.get(key)
  }
  const storage = getRuntimeStorage()
  if (!storage) {
    return ''
  }
  const raw = storage.getItem(storageKeyWithPrefix(key))
  if (raw == null) {
    return ''
  }
  const decoded = decodeStorageValue(raw)
  memoryStorage.set(key, decoded)
  return decoded
}

export function removeStorageSyncInternal(key: string) {
  memoryStorage.delete(key)
  const storage = getRuntimeStorage()
  if (storage) {
    storage.removeItem(storageKeyWithPrefix(key))
  }
}

export function clearStorageSyncInternal() {
  memoryStorage.clear()
  const storage = getRuntimeStorage()
  if (!storage) {
    return
  }
  const removeKeys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(WEB_STORAGE_PREFIX)) {
      removeKeys.push(key)
    }
  }
  for (const key of removeKeys) {
    storage.removeItem(key)
  }
}

function calculateStorageCurrentSize(keys: string[]) {
  let bytes = 0
  for (const key of keys) {
    const value = getStorageSyncInternal(key)
    const encoded = encodeStorageValue(value)
    bytes += encoded.length
  }
  return Math.ceil(bytes / 1024)
}

export function getStorageInfoSyncInternal() {
  const keys = listStorageKeys()
  return {
    errMsg: 'getStorageInfoSync:ok',
    keys,
    currentSize: calculateStorageCurrentSize(keys),
    limitSize: WEB_STORAGE_LIMIT_SIZE_KB,
  }
}
