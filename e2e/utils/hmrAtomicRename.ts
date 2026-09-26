import fs from 'node:fs/promises'
import process from 'node:process'
import timers from 'node:timers/promises'

const WINDOWS_TRANSIENT_RENAME_ERRORS = new Set(['EPERM', 'EACCES', 'EBUSY'])
const MAX_WINDOWS_RETRIES = 20

/** Windows 短暂文件锁仅重试同一次原子发布，不删除旧目标，也不回退为复制或直接写入。 */
export async function renameAtomicFile(source: string, destination: string, platform = process.platform) {
  for (let retry = 0; ; retry++) {
    try {
      await fs.rename(source, destination)
      return
    }
    catch (error) {
      if (
        platform !== 'win32'
        || retry >= MAX_WINDOWS_RETRIES
        || !WINDOWS_TRANSIENT_RENAME_ERRORS.has((error as NodeJS.ErrnoException).code ?? '')
      ) {
        throw error
      }
      // 总等待最多 1550ms；每次让出事件循环，让 watcher、索引器或安全扫描释放文件句柄。
      await timers.setTimeout(Math.min((retry + 1) * 10, 100))
    }
  }
}
