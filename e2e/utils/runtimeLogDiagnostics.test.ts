import type { IdeReportEvent, IdeWarningReportPaths } from './ideWarningReport'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appendIdeReportEvent, writeIdeWarningReport } from './ideWarningReport'
import { captureRuntimeLogDiagnostics, sanitizeRuntimeLogDiagnostics } from './runtimeLogDiagnostics'

const clock = { sessionId: 'session-a', subscriptionId: 'subscription-a', receivedAtMonotonicMs: 150 }
const reportRoots: string[] = []

afterEach(() => {
  vi.unstubAllEnvs()
  for (const root of reportRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('runtime log origin diagnostics', () => {
  it('keeps original CDP time and stack metadata separate from receipt time without copying business objects', () => {
    const stackTrace = {
      callFrames: [{ functionName: 'launch', url: 'https://runtime.invalid/app.js', lineNumber: 10, columnNumber: 2, locals: { secret: true } }],
    }
    const diagnostics = captureRuntimeLogDiagnostics({
      params: { timestamp: 50, executionContextId: 7, stackTrace, args: [{ value: { businessData: 'private' } }], arbitrary: 'excluded' },
    }, clock)
    expect(diagnostics).toEqual({
      ...clock,
      originalTimestamp: 50,
      executionContextId: 7,
      stackTrace: { callFrames: [{ functionName: 'launch', url: 'https://runtime.invalid/app.js', lineNumber: 10, columnNumber: 2 }] },
    })
    expect(captureRuntimeLogDiagnostics({ timestamp: 50 }, { ...clock, subscriptionId: 'subscription-b', receivedAtMonotonicMs: 300 }))
      .toEqual({ ...clock, subscriptionId: 'subscription-b', receivedAtMonotonicMs: 300, originalTimestamp: 50 })
  })

  it('records exception origin fields while discarding remote exception objects and invalid timestamps', () => {
    const diagnostics = captureRuntimeLogDiagnostics({
      timestamp: Number.NaN,
      executionContextId: 'invalid',
      exceptionDetails: {
        exceptionId: 3,
        text: 'Uncaught',
        url: 'https://runtime.invalid/app.js',
        lineNumber: 9,
        columnNumber: 1,
        executionContextId: 7,
        stackTrace: { callFrames: [{ functionName: 'onLaunch', lineNumber: 9, columnNumber: 1 }] },
        exception: { objectId: 'private-object', value: { userData: 'excluded' } },
      },
    }, clock)
    expect(diagnostics).toEqual({
      ...clock,
      exceptionDetails: {
        exceptionId: 3,
        text: 'Uncaught',
        url: 'https://runtime.invalid/app.js',
        lineNumber: 9,
        columnNumber: 1,
        executionContextId: 7,
        stackTrace: { callFrames: [{ functionName: 'onLaunch', lineNumber: 9, columnNumber: 1 }] },
      },
    })
  })

  it('does not enumerate or read unrelated payload getters', () => {
    const payload = { timestamp: 50, executionContextId: 7 }
    const fail = vi.fn(() => {
      throw new Error('Business payload must not be inspected')
    })
    Object.defineProperties(payload, {
      args: { enumerable: true, get: fail },
      arbitrary: { enumerable: true, get: fail },
    })
    expect(captureRuntimeLogDiagnostics(payload, clock)).toEqual({ ...clock, originalTimestamp: 50, executionContextId: 7 })
    expect(fail).not.toHaveBeenCalled()
  })

  it('bounds asynchronous stack chains and marks truncation without traversing arbitrary payloads', () => {
    const stack: Record<string, unknown> = { callFrames: Array.from({ length: 33 }, () => ({ functionName: 'launch' })) }
    stack.parent = stack
    const diagnostics = captureRuntimeLogDiagnostics({ stackTrace: stack }, clock)
    expect(diagnostics.stackTrace?.callFrames).toHaveLength(32)
    expect(diagnostics.stackTrace?.truncated).toBe(true)
    expect(diagnostics.stackTrace?.parent?.parent?.parent).toMatchObject({ truncated: true })
    expect(diagnostics.stackTrace?.parent?.parent?.parent?.parent).toBeUndefined()
    expect(sanitizeRuntimeLogDiagnostics({ ...clock, receivedAtMonotonicMs: Number.POSITIVE_INFINITY }, value => value)).toBeUndefined()
  })

  it.each([
    '/Volumes/workspace/app.js',
    '/Applications/Tool/runtime/app.js',
    '/mnt/build/app.js',
    '/etc/runtime/app.js',
    'C:\\Users\\example\\workspace\\app.js',
    '\\\\server\\workspace\\app.js',
    'file:///Volumes/workspace/app.js',
    'file:///C:/Users/example/workspace/app.js',
    'file://localhost/mnt/workspace/app.js',
  ])('redacts a foreign filesystem path while retaining its basename (%s)', (url) => {
    const diagnostics = captureRuntimeLogDiagnostics({
      stackTrace: { callFrames: [{ functionName: `at ${url}:10:2`, url, lineNumber: 10, columnNumber: 2 }] },
      exceptionDetails: { url, text: `Uncaught at ${url}` },
    }, clock)
    const sanitized = sanitizeRuntimeLogDiagnostics(diagnostics, value => value)
    expect(sanitized?.stackTrace?.callFrames).toEqual([{ functionName: 'at app.js:10:2', url: 'app.js', lineNumber: 10, columnNumber: 2 }])
    expect(sanitized?.exceptionDetails).toEqual({ url: 'app.js', text: 'Uncaught at app.js' })
  })

  it.each([
    '/Volumes/Private Team/project/app.js',
    'file:///Volumes/Private Team/project/app.js',
    'C:\\workspace\\Private Team\\project\\app.js',
    '\\\\server\\Private Team\\project\\app.js',
  ])('redacts complete and quoted paths containing spaces before the shared sanitizer (%s)', (url) => {
    const diagnostics = captureRuntimeLogDiagnostics({
      stackTrace: { callFrames: [{ functionName: `at "${url}:10:2"`, url: `${url}:10:2`, lineNumber: 10, columnNumber: 2 }] },
      exceptionDetails: { url, text: `Uncaught at '${url}' and \`${url}:10:2\`` },
    }, clock)
    const sanitize = vi.fn((value: string) => value)
    const sanitized = sanitizeRuntimeLogDiagnostics(diagnostics, sanitize)
    expect(sanitized?.stackTrace?.callFrames).toEqual([{ functionName: 'at "app.js:10:2"', url: 'app.js:10:2', lineNumber: 10, columnNumber: 2 }])
    expect(sanitized?.exceptionDetails).toEqual({ url: 'app.js', text: 'Uncaught at \'app.js\' and `app.js:10:2`' })
    expect(JSON.stringify(sanitize.mock.calls)).not.toContain('Private Team')
    expect(JSON.stringify(sanitize.mock.calls)).not.toContain('project/')
  })

  it.each([
    '/Volumes/Private Team/私有项目/app.js',
    '/Volumes/Private.v1 Team/私有项目/app.js',
    'file:///Volumes/Private Team/私有项目/app.js',
    'file://localhost/Volumes/Private Team/私有项目/app.js',
    'C:\\workspace\\Private Team\\私有项目\\app.js',
    '\\\\server\\Private Team\\私有项目\\app.js',
  ])('redacts an unquoted stack reference without consuming business text (%s)', (url) => {
    const diagnostics = captureRuntimeLogDiagnostics({
      stackTrace: { callFrames: [{ functionName: `at ${url}:10:2`, url, lineNumber: 10, columnNumber: 2 }] },
      exceptionDetails: { text: `Business error remains; at ${url}:10:2; status=left/right`, url },
    }, clock)
    const sanitize = vi.fn((value: string) => value)
    const sanitized = sanitizeRuntimeLogDiagnostics(diagnostics, sanitize)
    expect(sanitized?.stackTrace?.callFrames).toEqual([
      { functionName: 'at app.js:10:2', url: 'app.js', lineNumber: 10, columnNumber: 2 },
    ])
    expect(sanitized?.exceptionDetails).toEqual({ text: 'Business error remains; at app.js:10:2; status=left/right', url: 'app.js' })
    expect(JSON.stringify(sanitize.mock.calls)).not.toContain('Private Team')
    expect(JSON.stringify(sanitize.mock.calls)).not.toContain('Private.v1 Team')
    expect(JSON.stringify(sanitize.mock.calls)).not.toContain('私有项目')
  })

  it.each(['\n at ', ' then '])('redacts every stack reference separated by %j and keeps the surrounding message', (separator) => {
    const diagnostics = captureRuntimeLogDiagnostics({
      exceptionDetails: {
        text: `Business failure at /Volumes/Private Team/私有项目/first.js:10:2${separator}C:\\workspace\\Private Team\\私有项目\\second.js:20:3; status=left/right`,
      },
    }, clock)
    expect(sanitizeRuntimeLogDiagnostics(diagnostics, value => value)?.exceptionDetails?.text)
      .toBe(`Business failure at first.js:10:2${separator}second.js:20:3; status=left/right`)
  })

  it('uses stack coordinates for unfamiliar filenames and preserves subsequent HTTP resource URLs', () => {
    const url = 'http://127.0.0.1:12345/appservice-hotreload/app.js?generation=2'
    const diagnostics = captureRuntimeLogDiagnostics({
      exceptionDetails: { text: `Business failure at /Volumes/Private Team/私有项目/source.custom:10:2 then ${url}; status=ready` },
    }, clock)
    expect(sanitizeRuntimeLogDiagnostics(diagnostics, value => value)?.exceptionDetails?.text)
      .toBe(`Business failure at source.custom:10:2 then ${url}; status=ready`)
  })

  it.each(['   ', '\t\t'])('keeps consecutive whitespace %j between local references and an HTTP URL', (separator) => {
    const url = 'http://127.0.0.1:12345/appservice-hotreload/app.js?generation=2'
    const diagnostics = captureRuntimeLogDiagnostics({
      exceptionDetails: { text: `Business failure at /Volumes/Private Team/私有项目/first.js${separator}C:\\workspace\\Private Team\\私有项目\\second.custom:20:3${separator}${url}; status=ready` },
    }, clock)
    expect(sanitizeRuntimeLogDiagnostics(diagnostics, value => value)?.exceptionDetails?.text)
      .toBe(`Business failure at first.js${separator}second.custom:20:3${separator}${url}; status=ready`)
  })

  it('redacts an unquoted script reference without coordinates or consuming its trailing message', () => {
    const diagnostics = captureRuntimeLogDiagnostics({
      exceptionDetails: { text: 'Uncaught at /Volumes/Private.v1 Team/私有项目/app.js; status=ready' },
    }, clock)
    expect(sanitizeRuntimeLogDiagnostics(diagnostics, value => value)?.exceptionDetails?.text)
      .toBe('Uncaught at app.js; status=ready')
  })

  it('retains remote runtime resource URLs for stack alignment', () => {
    const url = 'http://127.0.0.1:12345/appservice-hotreload/pages/index/index.js?generation=2'
    const diagnostics = captureRuntimeLogDiagnostics({ stackTrace: { callFrames: [{ functionName: 'onLaunch', url, lineNumber: 10, columnNumber: 2 }] } }, clock)
    expect(sanitizeRuntimeLogDiagnostics(diagnostics, value => value)?.stackTrace?.callFrames)
      .toEqual([{ functionName: 'onLaunch', url, lineNumber: 10, columnNumber: 2 }])
  })

  it('writes sanitized origin metadata while retaining duplicate error counts, levels and text', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-log-origin-'))
    reportRoots.push(root)
    const paths: IdeWarningReportPaths = {
      reportSlug: 'runtime-log-origin',
      reportDir: path.join(root, 'report'),
      eventLogPath: path.join(root, 'events.jsonl'),
      reportMarkdownPath: path.join(root, 'report/index.md'),
      reportJsonPath: path.join(root, 'report/index.json'),
    }
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_SLUG', paths.reportSlug)
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_DIR', paths.reportDir)
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', paths.eventLogPath)
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_MD_FILE', paths.reportMarkdownPath)
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_JSON_FILE', paths.reportJsonPath)
    const rawUrl = path.join(root, 'app.js')
    for (const subscriptionId of ['subscription-a', 'subscription-b']) {
      const diagnostics = {
        ...captureRuntimeLogDiagnostics({ timestamp: 50, executionContextId: 7, stackTrace: { callFrames: [{ functionName: 'launch', url: rawUrl, lineNumber: 1, columnNumber: 2 }] } }, { ...clock, subscriptionId }),
        arbitraryPayload: { mustNotBeStored: true },
      }
      appendIdeReportEvent({ source: 'runtime', kind: 'message', project: 'e2e-apps/base', level: 'error', text: 'appLaunch with non-empty page stack', runtimeLogDiagnostics: diagnostics })
    }
    const raw = fs.readFileSync(paths.eventLogPath, 'utf8')
    const stored = raw.trim().split('\n').map(line => JSON.parse(line) as IdeReportEvent)
    expect(raw).not.toContain(root)
    expect(raw).not.toContain('mustNotBeStored')
    expect(stored).toHaveLength(2)
    expect(stored.map(event => ({ level: event.level, text: event.text }))).toEqual(Array.from({ length: 2 }, () => ({ level: 'error', text: 'appLaunch with non-empty page stack' })))
    expect(stored.map(event => event.runtimeLogDiagnostics?.originalTimestamp)).toEqual([50, 50])
    expect(stored[0]?.runtimeLogDiagnostics?.stackTrace?.callFrames[0]?.url).toBe('app.js')
    fs.mkdirSync(paths.reportDir, { recursive: true })
    const report = writeIdeWarningReport(paths)
    expect(report.summary).toMatchObject({ runtimeError: 2, runtimeWarn: 0, runtimeException: 0, totalIssues: 2 })
  })
})
