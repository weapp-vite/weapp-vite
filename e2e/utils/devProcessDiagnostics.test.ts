import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDevProcessDiagnostics } from './devProcessDiagnostics'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('dev process diagnostics', () => {
  it('records forwarded startup errors across chunk and UTF-8 boundaries', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    const bytes = Buffer.from('[mini:error] 启动失败\r\n')
    collector.write(bytes.subarray(0, 15))
    collector.write(bytes.subarray(15))
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith({
      source: 'runtime',
      kind: 'message',
      project: 'apps/demo',
      level: 'error',
      channel: 'forward-console',
      text: '启动失败',
    })
  })

  it('preserves empty error payloads and flushes a final unterminated error once', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('[mini:error] {}\n[mini:error]\n[mini:exception]')
    collector.flush()
    collector.flush()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([entry]) => [entry.level, entry.text])).toEqual([
      ['error', '{}'],
      ['error', '<empty console payload>'],
      ['exception', '<empty console payload>'],
    ])
  })

  it('requires explicit log prefixes and preserves ordinary error-related messages as logs', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('Error handling enabled\n[info] no error\n[mini:log] Error handling enabled\n[warn] compiler warning\n[error] compiler failed\n')
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([entry]) => [entry.source, entry.level, entry.text])).toEqual([
      ['runtime', 'log', 'Error handling enabled'],
      ['build', 'warn', '[warn] compiler warning'],
      ['build', 'error', '[error] compiler failed'],
    ])
  })

  it('recognizes ANSI-colored error prefixes', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('\u001B[31m[mini:error]\u001B[0m failed\n')
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', text: 'failed' }))
  })

  it('recognizes the existing Consola severity framing without matching ordinary prose', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write(' ERROR  compile failed\n[compile]  WARN  missing source\nError handling enabled\nERROR handling enabled\n')
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([entry]) => [entry.level, entry.text])).toEqual([
      ['error', 'ERROR  compile failed'],
      ['warn', '[compile]  WARN  missing source'],
    ])
  })

  it('collects the actual stateful HMR client failure and stack across chunks', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    const header = '[weapp-vite] stateful HMR client patch-failed: No factory registered for module shared/runtime.mjs'
    const stack = 'Error: No factory registered for module shared/runtime.mjs\n    at WeappViteDevRuntime.initModule (bundle.js:851:15)\n    at Object.receiveBatch (update.js:5:47)'
    collector.write(`${header}\r\nError: No factory registered for module shared/`)
    collector.write('runtime.mjs\r\n    at WeappViteDevRuntime.initModule (bundle.js:851:15)\r\n    at Object.receive')
    collector.write('Batch (update.js:5:47)\n[hmr-diagnosis:full-build] Error: full-build origin\n    at unrelated (diagnosis.js:1:1)\n')
    collector.flush()
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith({
      source: 'build',
      kind: 'message',
      project: 'apps/demo',
      level: 'error',
      channel: 'dev-process',
      text: `${header}\n${stack}`,
    })
  })

  it.each([
    '[weapp-vite] stateful HMR client bridge-not-ready: missing bridge',
    '[weapp-vite] stateful HMR: transform rejected',
    '[weapp-vite] stateful HMR snapshot refresh failed',
    '[weapp-vite] stateful HMR patch transform failed',
    '[weapp-vite] stateful HMR server restart failed',
    '[weapp-vite] stateful HMR output failed: output rejected',
  ])('recognizes an explicit error logger message: %s', (header) => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write(header)
    collector.flush()
    collector.flush()
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ level: 'error', text: header }))
  })

  it('preserves colored Vite error details and excludes later unrelated lines', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('\u001B[2m3:04:05 PM\u001B[0m \u001B[31m[vite]\u001B[0m Internal server error: invalid template\n  Plugin: vite:vue\n  File: src/index.vue:2:3\n  2 | <invalid>\n    | ^\n    at transform (compiler.js:2:3)\nserver listening\n    at unrelated (server.js:3:4)\n')
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      text: '3:04:05 PM [vite] Internal server error: invalid template\n  Plugin: vite:vue\n  File: src/index.vue:2:3\n  2 | <invalid>\n    | ^\n    at transform (compiler.js:2:3)',
    }))
  })

  it.each([
    'Pre-transform error: invalid source',
    '[vite] Pre-transform error (src/index.ts): invalid source',
    '15:04:05 [vite] client Pre-transform error: invalid source',
  ])('recognizes the Vite pre-transform error format: %s', (header) => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write(`${header}\n`)
    collector.flush()
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ level: 'error', text: header }))
  })

  it('flushes the last error of a live process after a short idle period', () => {
    vi.useFakeTimers()
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('[weapp-vite] stateful HMR client patch-failed: rejected\n')
    vi.advanceTimersByTime(10)
    collector.write('Error: rejected\n    at patch (runtime.js:1:2)\n')
    expect(appendIdeReportEvent).not.toHaveBeenCalled()
    vi.advanceTimersByTime(25)
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      text: '[weapp-vite] stateful HMR client patch-failed: rejected\nError: rejected\n    at patch (runtime.js:1:2)',
    }))
    collector.flush()
    vi.runAllTimers()
    expect(appendIdeReportEvent).toHaveBeenCalledTimes(1)
  })

  it('flushes an unterminated final stack frame once and cancels its idle timer', () => {
    vi.useFakeTimers()
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('[weapp-vite] stateful HMR: rejected\nTypeError: rejected\n    at patch (runtime.js:1:2)')
    collector.flush()
    vi.runAllTimers()
    collector.flush()
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      text: '[weapp-vite] stateful HMR: rejected\nTypeError: rejected\n    at patch (runtime.js:1:2)',
    }))
  })

  it('ends a build stack before a forwarded console message or another error title', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('[weapp-vite] stateful HMR: first\nError: first\n    at patch (runtime.js:1:2)\nError: unrelated\n    at unrelated (other.js:3:4)\n[weapp-vite] stateful HMR: second\n[mini:error] runtime failed\n    at another (other.js:5:6)\n')
    collector.flush()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([entry]) => [entry.source, entry.level, entry.text])).toEqual([
      ['build', 'error', '[weapp-vite] stateful HMR: first\nError: first\n    at patch (runtime.js:1:2)'],
      ['build', 'error', '[weapp-vite] stateful HMR: second'],
      ['runtime', 'error', 'runtime failed'],
    ])
  })

  it('separates consecutive errors, forwarded console messages, and blank stack boundaries', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('[weapp-vite] stateful HMR: first\nError: first\n[weapp-vite] stateful HMR: second\nError: second\n\n    at unrelated (other.js:1:1)\n[mini:info] recovered\n')
    collector.flush()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([entry]) => [entry.level, entry.text])).toEqual([
      ['error', '[weapp-vite] stateful HMR: first\nError: first'],
      ['error', '[weapp-vite] stateful HMR: second\nError: second'],
      ['info', 'recovered'],
    ])
  })

  it('does not classify ordinary Vite or stateful HMR messages as errors', () => {
    const collector = createDevProcessDiagnostics('apps/demo')
    collector.write('[weapp-vite] stateful HMR client ready\n[weapp-vite] stateful HMR patch transform succeeded\n[weapp-vite] stateful HMR output failed-check enabled\n[vite] hmr update src/index.ts\n[vite] client Error handling enabled\nError: unrelated text\n    at unrelated (other.js:1:1)\n')
    collector.flush()
    expect(appendIdeReportEvent).not.toHaveBeenCalled()
  })
})
