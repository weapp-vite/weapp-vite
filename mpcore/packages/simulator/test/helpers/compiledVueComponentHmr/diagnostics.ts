import path from 'node:path'
import process from 'node:process'

/** 阶段记录只保存相对文件身份和有限事件，不记录源码或生成代码。 */
export function createHmrFixtureTrace(root: string, type: string) {
  const started = performance.now()
  const events: Array<Record<string, unknown>> = []
  let editIndex: number | null = null
  const file = (id: string) => {
    if (id.startsWith('\0')) {
      return '<virtual>'
    }
    const relative = path.relative(root, id).replaceAll('\\', '/')
    return relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative || '<root>'
  }
  const error = (value: unknown, depth = 0): unknown => {
    if (!(value instanceof Error)) {
      return { type: typeof value }
    }
    return {
      name: value.name,
      message: value.message.replaceAll(root, '<fixture-root>').replaceAll(root.replaceAll('\\', '/'), '<fixture-root>'),
      ...(depth < 2 && value.cause !== undefined ? { cause: error(value.cause, depth + 1) } : {}),
    }
  }
  const record = (event: string, details: Record<string, unknown> = {}) => {
    events.push({ at: Math.round(performance.now() - started), editIndex, event, ...details })
    if (events.length > 64) {
      events.shift()
    }
  }
  return {
    file,
    error,
    record,
    setEditIndex(index: number | null) { editIndex = index },
    report(value: unknown) {
      try {
        process.stderr.write(`[vue-companion-native] ${JSON.stringify({ type, editIndex, error: error(value), events })}\n`)
      }
      catch {
        // 诊断输出不能覆盖原始 native 或断言错误。
      }
    },
  }
}
