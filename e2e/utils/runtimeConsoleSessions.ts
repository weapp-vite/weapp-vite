import { appendIdeReportEvent } from './ideWarningReport'

interface ConsoleSession {
  flushConsole?: () => Promise<void>
}

// 每个 E2E invocation 的 worker 模块持有自己的集合；会话关闭时由日志订阅统一释放。
const sessions = new Map<ConsoleSession, string>()

export function registerRuntimeConsoleSession(session: ConsoleSession, project: string) {
  if (typeof session.flushConsole === 'function') {
    sessions.set(session, project)
  }
  return () => sessions.delete(session)
}

export async function flushRuntimeConsoleSessions() {
  const entries = [...sessions.entries()]
  const results = await Promise.allSettled(entries.map(async ([session]) => await session.flushConsole?.()))
  const failures: unknown[] = []
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      failures.push(result.reason)
      appendIdeReportEvent({
        source: 'runtime',
        kind: 'message',
        project: entries[index]![1],
        level: 'error',
        channel: 'console-inspection',
        text: `Failed to flush runtime console: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      })
    }
  }
  if (failures.length === 1) {
    throw failures[0]
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Failed to flush runtime console sessions')
  }
}
