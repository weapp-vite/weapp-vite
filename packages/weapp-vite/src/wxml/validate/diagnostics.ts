import type { WxmlValidationDiagnostic } from '../../types'

/** 同一构建汇总可恢复的规则诊断；配置和回调异常由调用方立即抛出。 */
export function createValidationDiagnostics(warn: (message: string) => void) {
  const messages = new Map<string, { severity: 'warning' | 'error', text: string }>()
  return {
    report(fileName: string, callback: number, diagnostic: WxmlValidationDiagnostic) {
      if (!diagnostic || !['warning', 'error'].includes(diagnostic.severity)
        || typeof diagnostic.message !== 'string' || !diagnostic.message.trim()
        || (diagnostic.code !== undefined && (typeof diagnostic.code !== 'string' || !diagnostic.code.trim()))) {
        throw new TypeError('report expects a warning/error diagnostic with a nonempty message and optional code.')
      }
      const location = diagnostic.location
      if (location && (!Number.isInteger(location.offset) || location.offset < 0
        || !Number.isInteger(location.line) || location.line < 1
        || !Number.isInteger(location.column) || location.column < 1)) {
        throw new TypeError('Diagnostic location expects a nonnegative offset and positive line/column.')
      }
      const prefix = `[weapp.wxml.validate] ${fileName}${location ? `:${location.line}:${location.column}` : ''} (callback ${callback})`
      const text = `${prefix}${diagnostic.code ? ` [${diagnostic.code}]` : ''}: ${diagnostic.message}`
      const key = JSON.stringify([fileName, callback, diagnostic.severity, diagnostic.code, diagnostic.message, location?.offset, location?.line, location?.column])
      messages.set(key, { severity: diagnostic.severity, text })
    },
    finish() {
      const errors: string[] = []
      for (const { severity, text } of messages.values()) {
        if (severity === 'warning') {
          warn(text)
        }
        else {
          errors.push(text)
        }
      }
      if (errors.length) {
        throw new Error(`[weapp.wxml.validate] ${errors.length} validation error(s):\n${errors.join('\n')}`)
      }
    },
  }
}
