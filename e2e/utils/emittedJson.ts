import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fs } from '@weapp-core/shared/node'

/** 在同一等待预算内重读构建中的 JSON，仅重试文件缺失或尚未完整写入的解析错误。 */
export async function waitForEmittedJson(
  filePath: string,
  matches: (value: unknown) => boolean,
  options: { condition: string, timeoutMs?: number, intervalMs?: number },
): Promise<unknown> {
  const deadline = performance.now() + (options.timeoutMs ?? 90_000)
  const conditionError = () => new Error(`Latest valid JSON does not satisfy condition: ${options.condition}`)
  let lastCause: unknown = conditionError()
  while (performance.now() < deadline) {
    let snapshot: { value: unknown } | undefined
    try {
      snapshot = { value: await fs.readJson(filePath) }
    }
    catch (error) {
      if (!(error instanceof SyntaxError) && !(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
      lastCause = error
    }
    if (snapshot) {
      if (matches(snapshot.value)) {
        return snapshot.value
      }
      lastCause = conditionError()
    }
    const remainingMs = deadline - performance.now()
    if (remainingMs > 0) {
      await sleep(Math.min(options.intervalMs ?? 250, remainingMs))
    }
  }
  const detail = lastCause instanceof Error ? lastCause.message : String(lastCause)
  throw new Error(`Timed out waiting for JSON ${path.basename(filePath)} ${options.condition}. Last observation: ${detail}`, { cause: lastCause })
}
