import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertNoRecentDevtoolsSimulatorBootIssues,
  scanRecentDevtoolsSimulatorBootIssues,
} from '../utils/ide-devtools-logs'

function writeLog(rootDir: string, content: string) {
  const logFile = path.join(rootDir, 'profile-a', 'WeappLog/logs/2026-05-03-test.log')
  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  fs.writeFileSync(logFile, content, 'utf8')
  return logFile
}

function formatDevtoolsLogTimestamp(date: Date) {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

describe('ide devtools logs', () => {
  let sandboxRoot = ''

  beforeEach(() => {
    sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-devtools-logs-'))
  })

  afterEach(() => {
    fs.rmSync(sandboxRoot, { recursive: true, force: true })
  })

  it('detects simulator boot subPackages errors in recent WeChat DevTools logs', () => {
    const startedAt = Date.now() - 1_000
    const timestamp = formatDevtoolsLogTimestamp(new Date())
    writeLog(sandboxRoot, [
      `[${timestamp}][ERROR] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`,
      '[2026-05-03 12:08:14.848][INFO] ignored line',
    ].join('\n'))

    const issues = scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toContain('subPackages')
    expect(() => assertNoRecentDevtoolsSimulatorBootIssues({
      label: 'demo',
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })).toThrow('WeChat DevTools simulator boot error detected')
  })
})
