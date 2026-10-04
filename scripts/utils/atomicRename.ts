import fs from 'node:fs/promises'
import process from 'node:process'
import timers from 'node:timers/promises'

const WINDOWS_TRANSIENT_RENAME_ERRORS = new Set(['EPERM', 'EACCES', 'EBUSY'])
const MAX_WINDOWS_RETRIES = 20

interface AtomicRenameOptions {
  platform?: NodeJS.Platform
  signal?: AbortSignal
}

/** Windows 短暂文件锁仅重试同一次原子发布，沿用调用方期限，不删除旧目标或回退为复制。 */
export async function renameAtomicFile(source: string, destination: string, options: AtomicRenameOptions = {}) {
  const { platform = process.platform, signal } = options
  for (let retry = 0; ; retry++) {
    signal?.throwIfAborted()
    try {
      await fs.rename(source, destination)
      return
    }
    catch (error) {
      signal?.throwIfAborted()
      if (
        platform !== 'win32'
        || retry >= MAX_WINDOWS_RETRIES
        || !WINDOWS_TRANSIENT_RENAME_ERRORS.has((error as NodeJS.ErrnoException).code ?? '')
      ) {
        throw error
      }
      // 总等待最多 1550ms；原期限可提前中断，不能重试已取消的发布。
      try {
        await timers.setTimeout(Math.min((retry + 1) * 10, 100), undefined, { signal })
      }
      catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
  }
}
