import { LRUCache } from 'lru-cache'
import * as fs from '../../utils/fs'
import { normalizeLineEndings } from '../../utils/text'

interface FileSignature {
  ctimeMs: number
  ino: number
  mtimeMs: number
  size: number
}

export const mtimeCache = new Map<string, FileSignature>()

export const loadCache = new LRUCache<string, string>({
  max: 1024,
})

const pathExistsCache = new LRUCache<string, boolean>({
  max: 4096,
})

const sourceSignatures = new LRUCache<string, { source: string, signature: FileSignature }>({ max: 1024 })
const pendingReads = new Map<string, object>()

const transientRenameRetryDelays = [10, 25, 50]

function isMissingFileError(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'ENOENT'
}

/** 读取用于原子保存识别的文件签名，不提前改变缓存内容的有效性。 */
async function readFileSignature(id: string): Promise<FileSignature | undefined> {
  const stats = await fs.stat(id)
  const mtimeMs = typeof (stats as any)?.mtimeMs === 'number' ? (stats as any).mtimeMs : Number.NaN
  const ctimeMs = typeof (stats as any)?.ctimeMs === 'number' ? (stats as any).ctimeMs : Number.NaN
  const size = typeof (stats as any)?.size === 'number' ? (stats as any).size : Number.NaN
  const ino = typeof (stats as any)?.ino === 'number' ? (stats as any).ino : Number.NaN
  return [mtimeMs, ctimeMs, size, ino].every(Number.isFinite) ? { mtimeMs, ctimeMs, size, ino } : undefined
}

function sameFileSignature(left: FileSignature | undefined, right: FileSignature) {
  // 原子保存/rename 替换下，mtime 和 size 可能都保持不变；补充 ctime/ino 以识别同长度快速连续写入。
  return left !== undefined
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.size === right.size
    && left.ino === right.ino
}

/** 检查文件签名是否变化；签名观察不能单独证明缓存内容已更新。 */
export async function isInvalidate(id: string) {
  const signature = await readFileSignature(id)
  if (!signature) {
    return true
  }
  const unchanged = sameFileSignature(mtimeCache.get(id), signature)
  mtimeCache.set(id, signature)
  return !unchanged
}

export async function readFile(
  id: string,
  options?: { checkMtime?: boolean, encoding?: BufferEncoding },
): Promise<string> {
  const checkMtime = options?.checkMtime ?? true
  const encoding = options?.encoding ?? 'utf8'
  if (!checkMtime) {
    const cached = loadCache.get(id)
    if (cached !== undefined) {
      return cached
    }
  }

  const token = {}
  pendingReads.set(id, token)
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const signature = checkMtime ? await readFileSignature(id) : undefined
        if (signature) {
          const cached = sourceSignatures.get(id)
          if (cached && sameFileSignature(cached.signature, signature) && loadCache.get(id) === cached.source) {
            if (pendingReads.get(id) === token) {
              mtimeCache.set(id, signature)
            }
            return cached.source
          }
        }

        const content = normalizeLineEndings(await fs.readFile(id, encoding))
        // 只有当前读取拥有发布权；清缓存或后续读取都会撤销旧请求的发布权。
        if (pendingReads.get(id) === token) {
          loadCache.set(id, content)
          if (signature) {
            sourceSignatures.set(id, { source: content, signature })
            mtimeCache.set(id, signature)
          }
          else {
            sourceSignatures.delete(id)
            mtimeCache.delete(id)
          }
        }
        return content
      }
      catch (error) {
        const retryDelay = transientRenameRetryDelays[attempt]
        if (!isMissingFileError(error) || retryDelay === undefined) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }
  finally {
    if (pendingReads.get(id) === token) {
      pendingReads.delete(id)
    }
  }
}

/**
 * 判断文件或路径是否存在，可选缓存。
 */
export async function pathExists(
  id: string,
  options?: { ttlMs?: number },
): Promise<boolean> {
  const ttlMs = options?.ttlMs
  const cached = pathExistsCache.get(id)
  if (cached !== undefined) {
    return cached
  }
  const exists = await fs.pathExists(id)
  if (typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0) {
    pathExistsCache.set(id, exists, { ttl: ttlMs })
  }
  else {
    pathExistsCache.set(id, exists)
  }
  return exists
}

/**
 * 清理指定文件相关的缓存。
 */
export function invalidateFileCache(id: string) {
  pendingReads.delete(id)
  sourceSignatures.delete(id)
  mtimeCache.delete(id)
  loadCache.delete(id)
  pathExistsCache.delete(id)
}

/**
 * 清空所有文件缓存。
 */
export function clearFileCaches() {
  pendingReads.clear()
  sourceSignatures.clear()
  mtimeCache.clear()
  loadCache.clear()
  pathExistsCache.clear()
}
