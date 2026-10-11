import type { Browser, CDPSession } from 'playwright'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startHost } from '../helpers'
import { diagnosticBudget } from './budget'
import { hostDiagnostics } from './host'
import { cleanupModeResources, diagnosticLaunchOptions, startDiagnostics } from './index'
import { createEvidenceWriter, DIAGNOSTICS_ENV, HOST_EVIDENCE_ENV } from './writer'

const mocks = vi.hoisted(() => ({ mkdir: vi.fn(), appendFile: vi.fn(), writeFile: vi.fn(), stat: vi.fn(), execa: vi.fn() }))
vi.mock('node:fs/promises', () => mocks)
vi.mock('execa', () => ({ execa: mocks.execa }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mkdir.mockResolvedValue(undefined)
  mocks.appendFile.mockResolvedValue(undefined)
  mocks.writeFile.mockResolvedValue(undefined)
  mocks.stat.mockResolvedValue({ size: 123 })
  mocks.execa.mockImplementation(() => {
    throw new Error('No external process is allowed in contract tests')
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function events() {
  return mocks.appendFile.mock.calls.map(([, line]) => JSON.parse(String(line)) as Record<string, unknown>)
}

describe('opt-in cold navigation diagnostics', () => {
  it.each([undefined, '', '0', 'true'])('has no files, process, flags or plugin when disabled with %s', async (value) => {
    vi.stubEnv(DIAGNOSTICS_ENV, value)
    expect(await startDiagnostics('preview')).toBeUndefined()
    expect(hostDiagnostics({ [DIAGNOSTICS_ENV]: value, [HOST_EVIDENCE_ENV]: 'task-evidence/host.jsonl' })).toBe(false)
    expect(mocks.mkdir).not.toHaveBeenCalled()
    expect(mocks.appendFile).not.toHaveBeenCalled()
    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(mocks.execa).not.toHaveBeenCalled()
  })

  it('adds only Default NetLog flags and requires a task host evidence file', () => {
    expect(diagnosticLaunchOptions('task-evidence')).toEqual({ args: [
      `--log-net-log=${path.join('task-evidence', 'netlog.json')}`,
      '--net-log-capture-mode=Default',
    ] })
    expect(hostDiagnostics({ [DIAGNOSTICS_ENV]: '1' })).toBe(false)
  })

  it('adds no exit observer or child environment override to the default host', async () => {
    vi.useFakeTimers()
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const child = Object.assign(new EventEmitter(), { exitCode: null })
    mocks.execa.mockReturnValue({ stdout, stderr, nodeChildProcess: child, pid: process.pid })
    const starting = startHost('preview')
    stdout.emit('data', 'Local: http://127.0.0.1:0/dimina/')
    await vi.advanceTimersByTimeAsync(100)
    await starting
    expect(child.listenerCount('exit')).toBe(0)
    expect(mocks.execa.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ cwd: expect.any(String), reject: false }))
    expect(mocks.execa.mock.calls[0]?.[2]).not.toHaveProperty('env')
  })

  it('preserves an unavailable diagnostics directory as a collection error without starting resources', async () => {
    vi.stubEnv(DIAGNOSTICS_ENV, '1')
    mocks.mkdir.mockRejectedValueOnce(new Error('evidence directory unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await startDiagnostics('preview')).toBeUndefined()
      expect(mocks.execa).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledWith('[dimina-diagnostics]', expect.objectContaining({ phase: 'start' }))
    }
    finally {
      consoleError.mockRestore()
    }
  })

  it('records protocol identity, isolates sessions and only claims a completed browser close receipt', async () => {
    vi.stubEnv(DIAGNOSTICS_ENV, '1')
    const diagnostic = (await startDiagnostics('preview'))!
    const send = vi.fn(async (method: string) => method === 'SystemInfo.getProcessInfo'
      ? { processInfo: [{ id: process.pid, type: 'browser', cpuTime: 0 }] }
      : method === 'Browser.getBrowserCommandLine' ? { arguments: ['observed-browser', '--headless'] } : { product: 'Chrome/156.0.8078.4' })
    const detach = vi.fn(async () => undefined)
    const browser = { version: () => '156.0.8078.4', newBrowserCDPSession: async () => ({ send, detach }) } as unknown as Browser
    await diagnostic.browserConnected(browser)
    const original = new Error('page.goto: net::ERR_NO_BUFFER_SPACE')
    diagnostic.recordError('navigation-or-scenario', original)
    const first = diagnostic.finish()
    expect(diagnostic.finish()).toBe(first)
    await first
    expect(detach).toHaveBeenCalledOnce()
    expect(events()).toContainEqual(expect.objectContaining({ event: 'browser-version', version: '156.0.8078.4' }))
    expect(events()).toContainEqual(expect.objectContaining({ event: 'browser-protocol', method: 'Browser.getBrowserCommandLine', result: { arguments: ['observed-browser', '--headless'] } }))
    expect(events()).toContainEqual(expect.objectContaining({ event: 'original-error', error: { name: 'Error', message: original.message } }))
    expect(events()).toContainEqual(expect.objectContaining({ event: 'netlog-file', flushedAfterBrowserClose: false }))
    const next = (await startDiagnostics('dev'))!
    next.browserClosed()
    await next.finish()
    expect(mocks.mkdir.mock.calls[0]?.[0]).not.toEqual(mocks.mkdir.mock.calls[1]?.[0])
    expect(events()).toContainEqual(expect.objectContaining({ event: 'netlog-file', flushedAfterBrowserClose: true }))
  })

  it('bounds protocol capture and detach together without issuing later commands after the deadline', async () => {
    vi.useFakeTimers()
    vi.stubEnv(DIAGNOSTICS_ENV, '1')
    const diagnostic = (await startDiagnostics('preview'))!
    const send = vi.fn(() => new Promise(() => {}))
    const detach = vi.fn(() => new Promise<void>(() => {}))
    const browser = { version: () => 'observed-version', newBrowserCDPSession: async () => ({ send, detach }) as unknown as CDPSession } as unknown as Browser
    const capturing = diagnostic.browserConnected(browser)
    await vi.advanceTimersByTimeAsync(2000)
    await capturing
    expect(send).toHaveBeenCalledOnce()
    expect(detach).toHaveBeenCalledOnce()
    await diagnostic.finish()
    expect(mocks.writeFile.mock.calls).toContainEqual(expect.arrayContaining([
      expect.any(String),
      expect.stringContaining('Diagnostic protocol budget exhausted'),
    ]))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start an operation when its independent diagnostic budget is exhausted', async () => {
    vi.useFakeTimers()
    const withinBudget = diagnosticBudget(10)
    await vi.advanceTimersByTimeAsync(10)
    const operation = vi.fn(async () => undefined)
    await expect(withinBudget(operation)).rejects.toThrow('budget exhausted')
    expect(operation).not.toHaveBeenCalled()
  })

  it('detaches a late session after bounded creation fails and keeps the collection error separate', async () => {
    vi.useFakeTimers()
    vi.stubEnv(DIAGNOSTICS_ENV, '1')
    const diagnostic = (await startDiagnostics('preview'))!
    let opened!: (value: CDPSession) => void
    const opening = new Promise<CDPSession>((resolve) => {
      opened = resolve
    })
    const browser = { version: () => 'observed-version', newBrowserCDPSession: () => opening } as unknown as Browser
    const capturing = diagnostic.browserConnected(browser)
    await vi.advanceTimersByTimeAsync(1500)
    await capturing
    const detach = vi.fn(async () => undefined)
    opened({ detach } as unknown as CDPSession)
    await Promise.resolve()
    expect(detach).toHaveBeenCalledOnce()
    await diagnostic.finish()
    expect(mocks.writeFile.mock.calls).toContainEqual(expect.arrayContaining([expect.any(String), expect.stringContaining('browser-identity')]))
  })

  it('archives serialization and disk errors without throwing or replacing the original error', async () => {
    const writer = createEvidenceWriter('events.jsonl', 'errors.json', 2)
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => writer.record(circular)).not.toThrow()
    mocks.appendFile.mockRejectedValueOnce(new Error('disk unavailable'))
    const original = new Error('original navigation error')
    expect(() => writer.record({ event: 'original-error', message: original.message })).not.toThrow()
    writer.record({ event: 'over-limit' })
    await expect(writer.flush()).resolves.toBeUndefined()
    const errorFile = JSON.parse(String(mocks.writeFile.mock.calls.at(-1)?.[1])) as { errors: { phase: string }[], dropped: number }
    expect(errorFile.errors.map(error => error.phase)).toEqual(['serialize-evidence', 'write-evidence'])
    expect(errorFile.dropped).toBe(1)
    expect(original.message).toBe('original navigation error')
  })

  it('stops the host independently and preserves both cleanup failures while diagnostic failure stays separate', async () => {
    const browserError = new Error('browser close failed')
    const hostError = new Error('host stop failed')
    const stopHost = vi.fn(async () => {
      throw hostError
    })
    const diagnostics = {
      browserClosed: vi.fn(),
      recordError: vi.fn(),
      finish: vi.fn(async () => {
        throw new Error('diagnostic flush failed')
      }),
    }
    const result = cleanupModeResources({
      closeBrowser: async () => {
        throw browserError
      },
      stopHost,
      diagnostics,
    })
    await expect(result).rejects.toMatchObject({ cause: browserError, errors: [browserError, hostError] })
    expect(stopHost).toHaveBeenCalledOnce()
    expect(diagnostics.finish).toHaveBeenCalledOnce()
    expect(diagnostics.browserClosed).not.toHaveBeenCalled()
    expect(diagnostics.recordError).toHaveBeenCalledWith('diagnostic-teardown', expect.any(Error))
  })

  it('preserves the single original cleanup error and avoids a browser close receipt after launch failure', async () => {
    const original = new Error('host stop failed')
    const diagnostics = { browserClosed: vi.fn(), recordError: vi.fn(), finish: vi.fn(async () => undefined) }
    await expect(cleanupModeResources({
      stopHost: async () => {
        throw original
      },
      diagnostics,
    })).rejects.toBe(original)
    expect(diagnostics.browserClosed).not.toHaveBeenCalled()
    expect(diagnostics.finish).toHaveBeenCalledOnce()
  })
})
