import { randomUUID } from 'node:crypto'
import { appendIdeReportEvent } from './ideWarningReport'

/** 仅识别启动期间 currentPage 的已知协议暂态，不消费业务 console 或 exception。 */
export function isStartupCurrentPageProtocolError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const method = Reflect.get(error, 'method')
  const code = Reflect.get(error, 'code')
  return (error.message.includes('getPageMetaByWebviewId') && error.message.includes('rawPath') && error.message.includes('is null'))
    || (code === 'DEVTOOLS_PROTOCOL_TIMEOUT' && method === 'App.getCurrentPage')
    || /^Timeout in read current page(?: for route .+)? after \d+ms$/.test(error.message)
    || /^DevTools did not respond to protocol method App\.getCurrentPage within \d+ms$/.test(error.message)
}

/** 每次失败即时归档，只有实际页面就绪才能记录已恢复；不重置任何运行时错误。 */
export function createStartupProtocolDiagnostics(project: string, route: string) {
  const id = randomUUID()
  let attempts = 0
  let firstFailureAt = ''
  let lastFailureAt = ''
  let finished = false
  const append = (state: 'retrying' | 'recovered' | 'unresolved', text: string) => appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project,
    route,
    channel: 'startup-protocol',
    level: state === 'unresolved' ? 'error' : state === 'recovered' ? 'info' : 'warn',
    text,
    startupProtocol: { id, method: 'App.getCurrentPage', state, attempts, firstFailureAt, lastFailureAt },
  })
  return {
    record(error: unknown) {
      if (finished || !isStartupCurrentPageProtocolError(error)) {
        return
      }
      attempts += 1
      lastFailureAt = new Date().toISOString()
      firstFailureAt ||= lastFailureAt
      append('retrying', (error as Error).message)
    },
    finish(ready: boolean) {
      if (finished) {
        return
      }
      finished = true
      if (attempts) {
        append(ready ? 'recovered' : 'unresolved', `Startup current-page protocol ${ready ? 'recovered after rendered page readiness' : 'did not recover'} (${attempts} failed attempts)`)
      }
    },
  }
}
