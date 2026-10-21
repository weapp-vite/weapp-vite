import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { glob } from 'tinyglobby'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDeepWiki } from '../../.github/scripts/refresh-deepwiki/index.mjs'
import { createReporter } from '../../.github/scripts/refresh-deepwiki/report.mjs'
import { readWorkflowFixture } from '../workflowFixture.mjs'

describe('DeepWiki evidence provenance', () => {
  const directories: string[] = []
  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })
  async function temporaryDirectory() {
    const directory = await mkdtemp(join(tmpdir(), 'deepwiki-evidence-'))
    directories.push(directory)
    return directory
  }
  async function evidence(root: string) {
    const invocations = await Promise.all((await readdir(root)).map(async (invocation) => {
      return Promise.all((await readdir(join(root, invocation))).sort().map(async attempt => ({
        files: await readdir(join(root, invocation, attempt)),
        result: JSON.parse(await readFile(join(root, invocation, attempt, 'result.json'), 'utf8')) as {
          invocationId: string
          reportAttempt: number
          status: string
          screenshot: { captured: boolean, path?: string, error?: { message: string } }
          refreshResult?: { status: string }
        },
      })))
    }))
    return invocations.flat()
  }

  it('uploads hidden diagnostics only from the owned directory after failure and skips cancellation', async () => {
    const workflow = readWorkflowFixture('refresh-deepwiki.yml') as {
      jobs: { refresh: { steps: { uses?: string, if?: string, with?: Record<string, unknown> }[] } }
    }
    const upload = workflow.jobs.refresh.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload?.if).toBe('failure() && !cancelled()')
    expect(upload?.with?.path).toBe('.tmp/deepwiki-refresh/')
    expect(upload?.with?.['include-hidden-files']).toBe(true)
    const rootDirectory = await temporaryDirectory()
    const reports = [
      '.tmp/deepwiki-refresh/invocation/1/result.json',
      '.tmp/deepwiki-refresh/invocation/1/page.png',
      '.tmp/deepwiki-refresh/invocation/2/result.json',
    ]
    const unrelated = ['.env', '.tmp/unrelated/result.json', 'source.ts']
    for (const file of [...reports, ...unrelated]) {
      const parts = file.split('/')
      await mkdir(join(rootDirectory, ...parts.slice(0, -1)), { recursive: true })
      await writeFile(join(rootDirectory, file), '')
    }
    const selected = await glob(`${String(upload?.with?.path)}**/*`, {
      cwd: rootDirectory,
      dot: upload?.with?.['include-hidden-files'] === true,
    })
    expect(selected.sort()).toEqual(reports.sort())
  })

  it('binds a screenshot to its unique invocation instead of a later failed launch', async () => {
    const rootDirectory = await temporaryDirectory()
    const first = createReporter({ rootDirectory, log: vi.fn() })
    const second = createReporter({ rootDirectory, log: vi.fn() })
    const screenshot = vi.fn(async ({ path }: { path: string }) => writeFile(path, 'snapshot'))
    await first({ status: 'blocked', reason: 'Identity required' }, { screenshot })
    await second({ status: 'failed', reason: 'Browser launch failed' })
    const rows = await evidence(rootDirectory)
    expect(new Set(rows.map(row => row.result.invocationId)).size).toBe(2)
    expect(rows.find(row => row.result.status === 'blocked')).toMatchObject({
      files: expect.arrayContaining(['page.png']),
      result: { screenshot: { captured: true, path: 'page.png' } },
    })
    expect(rows.find(row => row.result.status === 'failed')).toMatchObject({
      files: ['result.json'],
      result: { screenshot: { captured: false } },
    })
  })

  it('preserves the first report and owned screenshot when later reporting fails', async () => {
    const rootDirectory = await temporaryDirectory()
    const log = vi.fn().mockImplementationOnce(() => {
      throw new Error('summary failed')
    })
    const report = createReporter({ rootDirectory, log })
    const screenshot = vi.fn(async ({ path }: { path: string }) => writeFile(path, 'snapshot'))
    await expect(report({ status: 'blocked', reason: 'Identity required' }, { screenshot })).rejects.toThrow('summary failed')
    await report({ status: 'failed', reason: 'summary failed' })
    expect(await evidence(rootDirectory)).toMatchObject([
      { files: expect.arrayContaining(['page.png']), result: { status: 'blocked', reportAttempt: 1, screenshot: { captured: true } } },
      { files: ['result.json'], result: { status: 'failed', reportAttempt: 2, screenshot: { captured: false } } },
    ])
  })

  it('retains a blocked result and snapshot when owned-browser cleanup fails', async () => {
    const rootDirectory = await temporaryDirectory()
    const report = createReporter({ rootDirectory, log: vi.fn() })
    const page = { screenshot: vi.fn(async ({ path }: { path: string }) => writeFile(path, 'snapshot')) }
    const browser = {
      newPage: async () => page,
      close: async () => {
        throw new Error('cleanup failed')
      },
    }
    const adapter = {
      navigate: async () => {},
      inspect: async () => ({ httpStatus: 200, controls: ['Enter email to refresh'] }),
      waitForIndex: async () => ({ text: 'Last indexed: 9 October 2026 (e85305)', href: 'https://github.com/weapp-vite/weapp-vite/commits/e85305ab' }),
    }
    try {
      await runDeepWiki({ launch: async () => browser, createAdapter: () => adapter, report, mainSha: 'a'.repeat(40), now: Date.UTC(2026, 9, 21) })
      throw new Error('Expected browser cleanup failure')
    }
    catch (error) {
      expect(error).toMatchObject({ message: 'cleanup failed', refreshResult: { status: 'blocked' }, cleanupError: { message: 'cleanup failed' } })
      const failure = error as Error & { refreshResult: { status: string } }
      await report({ status: 'failed', reason: failure.message, refreshResult: failure.refreshResult })
    }
    const rows = await evidence(rootDirectory)
    expect(new Set(rows.map(row => row.result.invocationId)).size).toBe(1)
    expect(rows).toMatchObject([
      { files: expect.arrayContaining(['page.png']), result: { status: 'blocked', reportAttempt: 1, screenshot: { captured: true } } },
      { files: ['result.json'], result: { status: 'failed', reportAttempt: 2, refreshResult: { status: 'blocked' }, screenshot: { captured: false } } },
    ])
  })

  it('bounds diagnostic copies and nested cleanup results while preserving full policy observations', async () => {
    const rootDirectory = await temporaryDirectory()
    const log = vi.fn()
    const report = createReporter({ rootDirectory, log })
    const pageState = {
      httpStatus: 200,
      url: `https://example.test/${'u'.repeat(2_001)}`,
      title: 't'.repeat(501),
      bodyText: `${'b'.repeat(12_001)} Verify you are human`,
      controls: [...Array.from({ length: 127 }, (_, i) => i === 0 ? 'c'.repeat(501) : `Navigation ${i}`), 'Enter email to refresh'],
      headings: Array.from({ length: 52 }, (_, i) => `Section ${i}`),
    }
    const refreshResult = { status: 'blocked', reason: 'Identity required', pageState }
    await report(refreshResult)
    await report({ status: 'failed', reason: 'cleanup failed', refreshResult, pageState })
    const invocations = await readdir(rootDirectory)
    const read = async (attempt: number) => JSON.parse(await readFile(join(rootDirectory, invocations[0]!, String(attempt), 'result.json'), 'utf8')) as { pageState: typeof pageState & { observation: Record<string, unknown> }, refreshResult?: { status: string, pageState: typeof pageState & { observation: Record<string, unknown> } } }
    const first = await read(1)
    const second = await read(2)
    expect(first.pageState).toMatchObject({
      url: pageState.url.slice(0, 2_000),
      title: pageState.title.slice(0, 500),
      bodyText: pageState.bodyText.slice(0, 12_000),
      controls: pageState.controls.slice(0, 100).map(value => value.slice(0, 500)),
      headings: pageState.headings.slice(0, 50),
      observation: {
        title: { originalCharacters: 501, retainedCharacters: 500, truncated: true },
        bodyText: { originalCharacters: pageState.bodyText.length, retainedCharacters: 12_000, truncated: true },
        controls: { originalCount: 128, retainedCount: 100, omittedCount: 28, truncatedEntries: 1, entryCharacterLimit: 500 },
        headings: { originalCount: 52, retainedCount: 50, omittedCount: 2, truncatedEntries: 0, entryCharacterLimit: 500 },
      },
    })
    expect(second.pageState).toEqual(first.pageState)
    expect(second.refreshResult).toEqual({ ...refreshResult, pageState: first.pageState })
    expect(pageState.bodyText).toContain('Verify you are human')
    expect(pageState.controls.at(-1)).toBe('Enter email to refresh')
    expect(pageState.controls).toHaveLength(128)
    expect(pageState.headings).toHaveLength(52)
    expect(log.mock.calls.flat().join('')).not.toContain(pageState.url)
  })

  it('retains an unsuccessful screenshot as a diagnostic error without claiming capture', async () => {
    const rootDirectory = await temporaryDirectory()
    const report = createReporter({ rootDirectory, log: vi.fn() })
    await report({ status: 'blocked', reason: 'Identity required' }, { screenshot: vi.fn(async () => {
      throw new Error('capture failed')
    }) })
    expect(await evidence(rootDirectory)).toMatchObject([{
      result: { status: 'blocked', screenshot: { captured: false, error: { message: 'capture failed' } } },
    }])
  })
})
