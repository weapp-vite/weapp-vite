import { describe, expect, it } from 'vitest'
import { attachRuntimeErrorCollector } from './runtimeErrors'

function createMiniProgramEmitter() {
  const listeners = new Map<string, Set<(entry: any) => void>>()

  return {
    emit(event: string, entry: any) {
      for (const listener of listeners.get(event) ?? []) {
        listener(entry)
      }
    },
    on(event: string, listener: (entry: any) => void) {
      let eventListeners = listeners.get(event)
      if (!eventListeners) {
        eventListeners = new Set()
        listeners.set(event, eventListeners)
      }
      eventListeners.add(listener)
    },
    removeListener(event: string, listener: (entry: any) => void) {
      listeners.get(event)?.delete(listener)
    },
  }
}

describe('runtimeErrors', () => {
  it('keeps all console logs while preserving error-only assertions', () => {
    const miniProgram = createMiniProgramEmitter()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()

    miniProgram.emit('console', { level: 'log', text: 'ordinary runtime log' })
    miniProgram.emit('console', { level: 'info', text: 'route ready info' })
    miniProgram.emit('console', { level: 'warn', text: 'runtime warning' })
    miniProgram.emit('console', { level: 'error', text: 'runtime error' })
    miniProgram.emit('exception', { exceptionDetails: { text: 'runtime exception' } })

    expect(collector.getSince(marker)).toEqual([
      '[console:error] runtime error',
      '[exception] runtime exception',
    ])
    expect(collector.getLogsSince(marker)).toEqual([
      '[console:log] ordinary runtime log',
      '[console:info] route ready info',
      '[console:warn] runtime warning',
      '[console:error] runtime error',
      '[exception] runtime exception',
    ])

    collector.dispose()
    miniProgram.emit('console', { level: 'error', text: 'after dispose' })
    expect(collector.getAll()).toEqual([
      '[console:error] runtime error',
      '[exception] runtime exception',
    ])
  })

  it('uses one marker timeline for error-only and full-log views', () => {
    const miniProgram = createMiniProgramEmitter()
    const collector = attachRuntimeErrorCollector(miniProgram)

    miniProgram.emit('console', { level: 'log', text: 'before marker log' })
    const marker = collector.mark()
    miniProgram.emit('console', { level: 'error', text: 'after marker error' })

    expect(collector.getSince(marker)).toEqual(['[console:error] after marker error'])
    expect(collector.getLogsSince(marker)).toEqual(['[console:error] after marker error'])
  })

  it('collects DevTools wrapped console errors', () => {
    const miniProgram = createMiniProgramEmitter()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()

    miniProgram.emit('console', {
      message: {
        level: 'error',
        args: [
          { value: '[wevu] 模板运行时表达式执行失败: __wv_bind_0 = JSON.stringify(queryKey)' },
          { value: { name: 'TypeError', message: 'Converting circular structure to JSON' } },
        ],
      },
    })

    expect(collector.getSince(marker)[0]).toContain('模板运行时表达式执行失败')
    expect(collector.getSince(marker)[0]).toContain('TypeError: Converting circular structure to JSON')
  })

  it('recognizes DevTools console entries that expose the level as type', () => {
    const miniProgram = createMiniProgramEmitter()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()

    miniProgram.emit('console', {
      message: {
        type: 'error',
        text: 'runtime error from message type',
      },
    })

    expect(collector.getSince(marker)).toEqual([
      '[console:error] runtime error from message type',
    ])
  })

  it('preserves DevTools RemoteObject descriptions and previews', () => {
    const miniProgram = createMiniProgramEmitter()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()

    miniProgram.emit('console', {
      message: {
        type: 'error',
        args: [
          {
            type: 'object',
            subtype: 'error',
            description: 'TypeError: Cannot read properties of undefined',
            value: {},
          },
          {
            type: 'object',
            preview: {
              properties: [
                { name: 'route', value: 'pages/index/index' },
                { name: 'status', value: 'failed' },
              ],
            },
          },
        ],
      },
    })

    expect(collector.getSince(marker)).toEqual([
      '[console:error] TypeError: Cannot read properties of undefined route: pages/index/index, status: failed',
    ])
  })

  it('supports providers without DevTools runtime event subscriptions', () => {
    const collector = attachRuntimeErrorCollector({})

    expect(collector.mark()).toBe(0)
    expect(collector.getAll()).toEqual([])
    expect(collector.getAllLogs()).toEqual([])
    expect(() => collector.dispose()).not.toThrow()
  })
})
