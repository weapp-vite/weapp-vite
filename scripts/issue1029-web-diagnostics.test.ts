import type { Page } from 'playwright'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureIssue1029WebFailure } from '../e2e/utils/issue1029WebDiagnostics'

const files = vi.hoisted(() => ({ mkdir: vi.fn(), mkdtemp: vi.fn(), writeFile: vi.fn() }))
vi.mock('node:fs/promises', () => files)

const root = path.resolve('diagnostic-repository')
const project = path.join(root, '.tmp/issue-1029-project')

function createOptions() {
  const page = {
    url: vi.fn(() => 'http://127.0.0.1/pages/home/index'),
    evaluate: vi.fn(async () => ({ currentPages: [{ route: 'pages/home/index' }], targets: [] })),
    screenshot: vi.fn(async () => Buffer.from('viewport')),
  }
  return {
    page,
    options: {
      page: page as unknown as Page,
      root,
      project,
      error: new Error(`original click failed at ${project}/src/page.vue`),
      pageErrors: [`error at ${root}/packages-runtime/web/runtime.ts`],
      devOutput: `dev starts at ${root}\nfixture: ${project}/src/page.vue\ntoken=private-value`,
    },
  }
}

function savedReport() {
  const write = files.writeFile.mock.calls.find(([file]) => String(file).endsWith('failure.json'))
  return JSON.parse(String(write?.[1])) as {
    failure: { message: string }
    pageErrors: string[]
    diagnosticErrors: Array<{ phase: string, message: string }>
  }
}

describe('issue1029 Web failure diagnostics without a browser', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    files.mkdir.mockReset().mockResolvedValue(undefined)
    files.mkdtemp.mockReset().mockImplementation(async (prefix: string) => `${prefix}sample`)
    files.writeFile.mockReset().mockResolvedValue(undefined)
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('captures one read-only probe and viewport with sanitized failure evidence', async () => {
    const { page, options } = createOptions()
    await captureIssue1029WebFailure(options)

    expect(page.evaluate).toHaveBeenCalledTimes(1)
    expect(page.screenshot).toHaveBeenCalledExactlyOnceWith({ timeout: 2_000 })
    expect(savedReport()).toMatchObject({
      failure: { message: 'original click failed at <project>/src/page.vue' },
      pageErrors: ['error at <repo>/packages-runtime/web/runtime.ts'],
      diagnosticErrors: [],
    })
    const logs = files.writeFile.mock.calls.map(([, content]) => String(content)).join('\n')
    expect(logs).not.toContain(root)
    expect(logs).not.toContain('private-value')
    expect(files.writeFile.mock.calls.some(([file]) => String(file).endsWith('viewport.png'))).toBe(true)
  })

  it('records probe errors separately while retaining the original failure', async () => {
    const { page, options } = createOptions()
    page.evaluate.mockRejectedValue(new Error(`renderer unavailable at ${root}/runtime.ts`))
    page.screenshot.mockRejectedValue(new Error('screenshot unavailable'))

    await expect(captureIssue1029WebFailure(options)).resolves.toBeUndefined()

    expect(savedReport()).toMatchObject({
      failure: { message: 'original click failed at <project>/src/page.vue' },
      diagnosticErrors: [
        { phase: 'DOM', message: 'renderer unavailable at <repo>/runtime.ts' },
        { phase: 'viewport screenshot', message: 'screenshot unavailable' },
      ],
    })
  })

  it.each(['DOM', 'viewport screenshot', 'artifact directory', 'artifact write'])('bounds a stalled %s within the shared budget', async (phase) => {
    const { page, options } = createOptions()
    const pending = new Promise<never>(() => {})
    if (phase === 'DOM') {
      page.evaluate.mockReturnValue(pending)
    }
    else if (phase === 'viewport screenshot') {
      page.screenshot.mockReturnValue(pending)
    }
    else if (phase === 'artifact directory') {
      files.mkdir.mockReturnValue(pending)
    }
    else {
      files.writeFile.mockReturnValue(pending)
    }
    const startedAt = Date.now()
    const capture = captureIssue1029WebFailure(options)

    await vi.advanceTimersByTimeAsync(2_500)
    await expect(capture).resolves.toBeUndefined()

    expect(Date.now() - startedAt).toBeLessThanOrEqual(2_500)
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining(`"phase":"${phase}","message":"diagnostic budget exhausted"`))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps evidence output errors from replacing the scenario failure', async () => {
    const { page, options } = createOptions()
    page.evaluate.mockRejectedValue(new Error('renderer unavailable'))
    vi.mocked(process.stderr.write).mockImplementation(() => {
      throw new Error('stderr closed')
    })

    await expect(captureIssue1029WebFailure(options)).resolves.toBeUndefined()

    expect(savedReport().failure.message).toBe('original click failed at <project>/src/page.vue')
  })

  it('does not start another filesystem stage after the total budget expires', async () => {
    const { options } = createOptions()
    let finishDirectory: (() => void) | undefined
    files.mkdir.mockReturnValue(new Promise<void>((resolve) => {
      finishDirectory = resolve
    }))
    const capture = captureIssue1029WebFailure(options)

    await vi.advanceTimersByTimeAsync(2_500)
    await capture
    finishDirectory?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(files.mkdtemp).not.toHaveBeenCalled()
    expect(files.writeFile).not.toHaveBeenCalled()
  })
})
