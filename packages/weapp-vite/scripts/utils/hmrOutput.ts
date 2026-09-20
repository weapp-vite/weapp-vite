import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { setTimeout } from 'node:timers/promises'

export const HMR_OUTPUT_POLL_INTERVAL_MS = 10

interface MeasureFileMarkerUpdateOptions {
  outputPath: string
  marker: string
  update: () => Promise<void>
  timeoutMs: number
  signal?: AbortSignal
}

/** 以新标记实际写入产物作为更新完成边界，日志不参与验收。 */
export async function measureFileMarkerUpdate(options: MeasureFileMarkerUpdateOptions) {
  const { outputPath, marker, update, timeoutMs, signal } = options
  if (!marker || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('HMR output measurement requires a marker and a positive timeout')
  }
  signal?.throwIfAborted()
  const initialOutput = await readFile(outputPath, 'utf8')
  if (initialOutput.includes(marker)) {
    throw new Error(`HMR output already contains the update marker: ${marker}`)
  }

  signal?.throwIfAborted()
  const startedAt = performance.now()
  await update()
  while (performance.now() - startedAt < timeoutMs) {
    signal?.throwIfAborted()
    let output: string | undefined
    try {
      output = await readFile(outputPath, 'utf8')
    }
    catch (error) {
      // 原子替换期间文件可短暂缺失，其他读取错误必须立即保留。
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    signal?.throwIfAborted()
    const elapsedMs = performance.now() - startedAt
    if (elapsedMs >= timeoutMs) {
      break
    }
    if (output?.includes(marker)) {
      return elapsedMs
    }
    await setTimeout(Math.min(HMR_OUTPUT_POLL_INTERVAL_MS, timeoutMs - elapsedMs), undefined, { signal })
  }
  throw new Error(`Timed out waiting for emitted HMR marker: ${marker}`)
}
