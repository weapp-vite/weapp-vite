import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertNoRecentDevtoolsSimulatorBootIssues,
  captureDevtoolsLogBaseline,
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

  it('ignores stale simulator boot lines already present in a reused log file', () => {
    const startedAt = Date.now() - 1_000
    const logFile = writeLog(sandboxRoot, [
      'simulator launch catch error TypeError: Cannot read property \'subPackages\' of undefined',
      '[2026-05-03 12:08:14.848][INFO] stale line',
    ].join('\n'))
    const baseline = captureDevtoolsLogBaseline({ rootDir: sandboxRoot })

    fs.appendFileSync(logFile, '\n[2026-05-03 12:08:15.000][INFO] launch started\n', 'utf8')

    expect(scanRecentDevtoolsSimulatorBootIssues({
      baseline,
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })).toEqual([])

    const timestamp = formatDevtoolsLogTimestamp(new Date())
    fs.appendFileSync(
      logFile,
      `[${timestamp}][ERROR] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined\n`,
      'utf8',
    )

    const issues = scanRecentDevtoolsSimulatorBootIssues({
      baseline,
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toContain('subPackages')
  })

  it('ignores stale simulator boot lines with a timezone offset', () => {
    const startedAt = Date.now() - 1_000
    writeLog(
      sandboxRoot,
      '[2020-01-01 00:00:00.000+08:00][ERROR] simulator launch catch error TypeError: Cannot read property \'subPackages\' of undefined',
    )

    expect(scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })).toEqual([])
  })

  it('ignores a transient simulator-not-found warning when the same simulator initializes', () => {
    const startedAt = Date.now() - 1_000
    const timestamp = formatDevtoolsLogTimestamp(new Date())
    writeLog(sandboxRoot, [
      `[${timestamp}][INFO] [SimulatorService] init simulator s0 with clientSid s0`,
      `[${timestamp}][WARN] [SimulatorService] updateSimulatorCompileOptions: simulator not found s0`,
      `[${timestamp}][WARN] [SimulatorService] updateSimulatorCompileOptions: simulator not found s1`,
      `[${timestamp}][INFO] [SimulatorService] init simulator s1 with clientSid s1`,
      `[${timestamp}][WARN] [SimulatorService] updateSimulatorCompileOptions: simulator not found s2`,
    ].join('\n'))

    const issues = scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toContain('simulator not found s2')
  })

  it('ignores a simulator launch error when the appservice subsequently launches successfully', () => {
    const startedAt = Date.now() - 1_000
    const timestamp = formatDevtoolsLogTimestamp(new Date())
    writeLog(sandboxRoot, [
      `[${timestamp}][ERROR] [appservice] simulator launch catch error Error: [summer-compiler] Couldn't found weapp_vite_internal/slot-wrapper/index.json`,
      `[${timestamp}][INFO] [appservice] simulator launch success, set src dist/app-service.js`,
    ].join('\n'))

    expect(scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })).toEqual([])
  })

  it('reports a simulator launch error when appservice validation fails after the success marker', () => {
    const startedAt = Date.now() - 1_000
    const timestamp = formatDevtoolsLogTimestamp(new Date())
    writeLog(sandboxRoot, [
      `[${timestamp}][ERROR] [appservice] simulator launch catch error Error: [summer-compiler] Couldn't found the '/weapp_vite_internal/slot-wrapper/index.json' file`,
      `[${timestamp}][INFO] [appservice] simulator launch success, set src http://127.0.0.1/appservice/mainframe`,
      `[${timestamp}][ERROR] [Devtools] appservice.js checkPluginInfo fail with error: Error: [summer-compiler] Couldn't found the '/weapp_vite_internal/slot-wrapper/index.json' file`,
    ].join('\n'))

    const issues = scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toContain('slot-wrapper/index.json')
  })

  it('reports the last simulator launch error when it has no later success signal', () => {
    const startedAt = Date.now() - 1_000
    const timestamp = formatDevtoolsLogTimestamp(new Date())
    writeLog(sandboxRoot, [
      `[${timestamp}][INFO] [appservice] simulator launch success, set src dist/app-service.js`,
      `[${timestamp}][ERROR] [appservice] simulator launch catch error Error: [summer-compiler] Couldn't found custom-tab-bar/index.json`,
    ].join('\n'))

    const issues = scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toContain('custom-tab-bar/index.json')
  })

  it('ignores informational compile-cache lines with undefined metadata', () => {
    const startedAt = Date.now() - 1_000
    const timestamp = formatDevtoolsLogTimestamp(new Date())
    writeLog(
      sandboxRoot,
      `[${timestamp}][INFO] cacheSubKey: 'dist/subpackages/normal/index.json', lastKeyInfo: undefined`,
    )

    expect(scanRecentDevtoolsSimulatorBootIssues({
      rootDir: sandboxRoot,
      sinceMs: startedAt,
    })).toEqual([])
  })
})
