import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureHmrStyleFailure } from '../e2e/utils/hmrStyleDiagnostics'
import { appendIdeReportEvent } from '../e2e/utils/ideWarningReport'
import { createIssue1015HmrDiagnostics } from '../e2e/utils/issue1015HmrDiagnostics'

const files = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock('node:fs/promises', () => files)
vi.mock('../e2e/utils/hmrStyleDiagnostics', () => ({ captureHmrStyleFailure: vi.fn() }))
vi.mock('../e2e/utils/ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

const projectPath = path.resolve('diagnostic-fixture')
const stylesheetPath = path.join(projectPath, 'dist/pages/issue-1015/index.wxss')
const source = '.issue1015-page { background-color: yellow; --issue-1015-step: style-only; }\n'

function createDiagnostics() {
  const captureOutput = vi.fn(async () => undefined)
  const captureRuntime = vi.fn(async () => undefined)
  const getDevOutput = vi.fn(() => `build at ${projectPath}\ntoken=private-value`)
  return {
    captureOutput,
    captureRuntime,
    getDevOutput,
    diagnostics: createIssue1015HmrDiagnostics({ stylesheetPath, projectPath, captureOutput, captureRuntime, getDevOutput }),
  }
}

describe('issue1015 HMR failure evidence without an IDE', () => {
  beforeEach(() => {
    files.readFile.mockReset().mockResolvedValue(Buffer.from(source))
    vi.mocked(captureHmrStyleFailure).mockReset().mockResolvedValue({ matchedStyles: null } as Awaited<ReturnType<typeof captureHmrStyleFailure>>)
    vi.mocked(appendIdeReportEvent).mockReset()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the first real emitted stylesheet silent until the original assertion fails', async () => {
    const { diagnostics, captureOutput, captureRuntime, getDevOutput } = createDiagnostics()
    await diagnostics.captureFirstStyleOnly()

    expect(files.readFile).toHaveBeenCalledExactlyOnceWith(stylesheetPath)
    expect(captureOutput).not.toHaveBeenCalled()
    expect(captureRuntime).not.toHaveBeenCalled()
    expect(getDevOutput).not.toHaveBeenCalled()
    expect(captureHmrStyleFailure).not.toHaveBeenCalled()
    expect(appendIdeReportEvent).not.toHaveBeenCalled()
    expect(process.stdout.write).not.toHaveBeenCalled()

    files.readFile.mockResolvedValue(Buffer.from('changed after the first read'))
    const send = vi.fn(async () => undefined)
    const session = { send }
    const snapshot = await diagnostics.captureFailure('style-only-failed', session)

    expect(snapshot.firstStyleOnly).toMatchObject({ source, bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') })
    expect(snapshot.stylesheet.source).toBe('changed after the first read')
    expect(captureOutput).toHaveBeenCalledExactlyOnceWith('style-only-failed')
    expect(captureRuntime).toHaveBeenCalledExactlyOnceWith('style-only-failed')
    expect(captureHmrStyleFailure).toHaveBeenCalledExactlyOnceWith({ send: expect.any(Function) }, {
      project: 'e2e-apps/github-issues/fixtures/issue-1015',
      selector: '#issue-1015-page',
      stylesheets: [{ fileName: 'pages/issue-1015/index.wxss', path: stylesheetPath }],
    })
    const adapter = vi.mocked(captureHmrStyleFailure).mock.calls[0]![0]
    await adapter.send('App.getCurrentPage', {}, { timeout: 1_000 })
    expect(send).toHaveBeenCalledExactlyOnceWith('App.getCurrentPage', {}, { timeout: 1_000 })
    expect(send.mock.contexts[0]).toBe(session)
    expect(snapshot.devOutput).toBe('build at <project>\n<redacted>')
    expect(JSON.stringify(vi.mocked(appendIdeReportEvent).mock.calls)).not.toContain(projectPath)
  })

  it('records absent original bytes and an unsupported provider without making protocol calls', async () => {
    const { diagnostics } = createDiagnostics()
    files.readFile.mockRejectedValue(new TypeError('private file path'))
    await expect(diagnostics.captureFirstStyleOnly()).resolves.toBeUndefined()
    const snapshot = await diagnostics.captureFailure('style-only-failed', {})

    expect(snapshot.firstStyleOnly).toMatchObject({ source: null, error: 'TypeError' })
    expect(snapshot.stylesheet).toMatchObject({ source: null, error: 'TypeError' })
    expect(snapshot.style).toEqual({ unsupported: true })
    expect(captureHmrStyleFailure).not.toHaveBeenCalled()
    expect(JSON.stringify(snapshot)).not.toContain('private file path')
  })

  it('continues every independent observer and retains the exact original failure when diagnostics fail', async () => {
    const { diagnostics, captureOutput, captureRuntime, getDevOutput } = createDiagnostics()
    captureOutput.mockRejectedValue(new Error('output failed'))
    captureRuntime.mockRejectedValue(new TypeError('runtime failed'))
    vi.mocked(captureHmrStyleFailure).mockRejectedValue(new RangeError('style failed'))
    getDevOutput.mockImplementation(() => {
      throw new Error('log failed')
    })
    vi.mocked(appendIdeReportEvent).mockImplementation(() => {
      throw new Error('report failed')
    })
    vi.mocked(process.stdout.write).mockImplementation(() => {
      throw new Error('stdout failed')
    })
    const original = new Error('original runtime assertion')
    let snapshot: Awaited<ReturnType<typeof diagnostics.captureFailure>> | undefined

    await expect(Promise.reject(original).catch(async (error) => {
      snapshot = await diagnostics.captureFailure('style-only-failed', { send: vi.fn() })
      throw error
    })).rejects.toBe(original)

    expect(snapshot?.errors).toEqual([
      { phase: 'output', name: 'Error' },
      { phase: 'runtime', name: 'TypeError' },
      { phase: 'style', name: 'RangeError' },
      { phase: 'dev output', name: 'Error' },
      { phase: 'report', name: 'Error' },
      { phase: 'stdout', name: 'Error' },
    ])
    expect(snapshot?.stylesheet.source).toBe(source)
    expect(files.readFile).toHaveBeenCalledExactlyOnceWith(stylesheetPath)
  })
})
