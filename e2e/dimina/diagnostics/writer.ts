import { appendFile, writeFile } from 'node:fs/promises'

export const DIAGNOSTICS_ENV = 'WEAPP_VITE_E2E_DIMINA_DIAGNOSTICS'
export const HOST_EVIDENCE_ENV = 'WEAPP_VITE_E2E_DIMINA_HOST_EVIDENCE'

export function diagnosticError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message.slice(0, 2000) }
    : { message: String(error).slice(0, 2000) }
}

/** 有限串行落盘，采集失败单独保存且不替换测试或宿主错误。 */
export function createEvidenceWriter(file: string, errorFile: string, limit = 1500) {
  let pending = Promise.resolve()
  let count = 0
  let dropped = 0
  const errors: Record<string, unknown>[] = []
  const onError = (phase: string, error: unknown) => {
    if (errors.length < 20) {
      errors.push({ at: new Date().toISOString(), phase, error: diagnosticError(error) })
    }
  }
  return {
    onError,
    record(event: Record<string, unknown>) {
      if (count++ >= limit) {
        dropped++
        return
      }
      try {
        const line = JSON.stringify({ at: new Date().toISOString(), ...event })
        pending = pending.then(() => appendFile(file, `${line}\n`)).catch(error => onError('write-evidence', error))
      }
      catch (error) {
        onError('serialize-evidence', error)
      }
    },
    async flush() {
      await pending
      try {
        await writeFile(errorFile, JSON.stringify({ errors, dropped }, null, 2))
      }
      catch (error) {
        // eslint-disable-next-line no-console -- 连错误文件也无法写入时仍保留采集错误，不影响原测试。
        console.error('[dimina-diagnostics]', { phase: 'write-errors', error: diagnosticError(error), errors, dropped })
      }
    },
  }
}
