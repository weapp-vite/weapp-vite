import { stat } from 'node:fs/promises'
import { isMissingWatchPath } from './scan'

function waitInterval(interval: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    timer = setTimeout(finish, interval)
    signal.addEventListener('abort', finish, { once: true })
  })
}

/** 写入稳定门禁只等待本轮触及的文件，关闭立即撤销计时。 */
export async function waitFileWatchStability(files: Iterable<string>, stability: { threshold: number, interval: number } | undefined, signal: AbortSignal) {
  if (!stability) {
    return
  }
  if (!Number.isFinite(stability.threshold) || stability.threshold < 0 || !Number.isFinite(stability.interval) || stability.interval <= 0) {
    throw new Error('File watcher stability requires a non-negative threshold and a positive interval')
  }
  await Promise.all([...files].map(async (file) => {
    let previous: string | undefined
    let stableSince = Date.now()
    while (!signal.aborted) {
      let signature: string
      try {
        const stats = await stat(file)
        if (!stats.isFile()) {
          return
        }
        signature = `${stats.mtimeMs}:${stats.size}`
      }
      catch (error) {
        if (isMissingWatchPath(error)) {
          return
        }
        throw error
      }
      if (previous !== signature) {
        previous = signature
        stableSince = Date.now()
      }
      else if (Date.now() - stableSince >= stability.threshold) {
        return
      }
      await waitInterval(stability.interval, signal)
    }
  }))
}
