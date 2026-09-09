import { StringDecoder } from 'node:string_decoder'
import { stripVTControlCharacters } from 'node:util'
import { appendIdeReportEvent } from './ideWarningReport'

const VITE_LOG_PREFIX = /^(?:\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\s+)?\[vite\]\s+(?:[\w-]+\s+(?=Internal server error:|Pre-transform error|\[weapp-vite\]))?/
const STATEFUL_HMR_ERROR = /^\[weapp-vite\] stateful HMR(?: client (?:patch-failed|bridge-not-ready):|:| (?:snapshot refresh|patch transform|server restart) failed(?:\s|$)| output failed:)/
const VITE_ERROR = /^(?:Internal server error:|Pre-transform error(?: \([^\r\n]+\))?:)/

export function createDevProcessDiagnostics(project: string) {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  let errorLines: string[] = []
  let errorTimer: ReturnType<typeof setTimeout> | undefined

  const flushError = () => {
    clearTimeout(errorTimer)
    errorTimer = undefined
    if (errorLines.length) {
      appendIdeReportEvent({
        source: 'build',
        kind: 'message',
        project,
        level: 'error',
        channel: 'dev-process',
        text: errorLines.join('\n'),
      })
      errorLines = []
    }
  }

  const appendErrorLine = (line: string) => {
    errorLines.push(line)
    clearTimeout(errorTimer)
    // 常驻进程可能不再输出下一行；短暂合并分块后及时落盘，退出时仍显式刷新。
    errorTimer = setTimeout(flushError, 25)
    errorTimer.unref?.()
  }

  const recordLine = (raw: string) => {
    const clean = stripVTControlCharacters(raw).trimEnd()
    const line = clean.trimStart()
    const loggerMessage = line.replace(VITE_LOG_PREFIX, '')
    if (STATEFUL_HMR_ERROR.test(loggerMessage) || VITE_ERROR.test(loggerMessage)) {
      flushError()
      appendErrorLine(line)
      return
    }
    if (errorLines.length) {
      const stackHeader = errorLines.length === 1 && /^(?:[\w.]*Error|Exception)(?::|$)/.test(line)
      const stackFrame = /^\s+at\s+\S/.test(clean)
      const viteDetail = /^\s+(?:(?:Plugin|File):\s|\d+\s*\||\|\s*\^)/.test(clean)
      if (stackHeader || stackFrame || viteDetail) {
        appendErrorLine(clean)
        return
      }
      flushError()
    }
    const runtime = line.match(/^\[mini:(debug|info|log|warn|error|exception)\](.*)$/)
    if (runtime) {
      appendIdeReportEvent({
        source: 'runtime',
        kind: 'message',
        project,
        level: runtime[1] as 'debug' | 'info' | 'log' | 'warn' | 'error' | 'exception',
        channel: 'forward-console',
        text: runtime[2]!.trim() || '<empty console payload>',
      })
      return
    }
    const build = line.match(/^\[(warn|error)\](?:\s|$)/i)
      ?? line.match(/^(?:\[[^\]\r\n]+\]\s+)?(WARN|ERROR) {2}/)
    if (build) {
      appendIdeReportEvent({
        source: 'build',
        kind: 'message',
        project,
        level: build[1]!.toLowerCase() as 'warn' | 'error',
        channel: 'dev-process',
        text: line,
      })
    }
  }

  const append = (text: string) => {
    pending += text
    let newline = pending.indexOf('\n')
    while (newline >= 0) {
      recordLine(pending.slice(0, newline))
      pending = pending.slice(newline + 1)
      newline = pending.indexOf('\n')
    }
  }

  return {
    write(chunk: string | Uint8Array) {
      append(typeof chunk === 'string' ? chunk : decoder.write(chunk))
    },
    flush() {
      append(decoder.end())
      if (pending) {
        recordLine(pending)
        pending = ''
      }
      flushError()
    },
  }
}
