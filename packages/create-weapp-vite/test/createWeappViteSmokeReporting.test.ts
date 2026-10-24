import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../../../scripts/createWeappViteSmoke/registry.mjs'
import { cleanupSmokeDirectory, recordSmokeFailure, writeSmokeReport } from '../../../scripts/createWeappViteSmoke/reporting.mjs'

interface SavedReport {
  complete: boolean
  results: { template: string }[]
  failures: { error: string }[]
  summary: { status: string, productFailures: number }
}

const roots: string[] = []

async function createReportFile() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-smoke-report-'))
  roots.push(root)
  return { root, file: path.join(root, 'report', 'report.json') }
}

async function readReport(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8')) as SavedReport
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('scaffold smoke evidence before cleanup', () => {
  it('persists each completed case without presenting a partial matrix as passed', async () => {
    const { file } = await createReportFile()
    const report = { registries: [], results: [{ template: 'default' }], failures: [] }

    await writeSmokeReport(report, file)
    expect(await readReport(file)).toMatchObject({ complete: false, results: [{ template: 'default' }], summary: { status: 'in-progress' } })

    report.results.push({ template: 'wevu' })
    await writeSmokeReport(report, file)
    expect((await readReport(file)).results).toEqual([{ template: 'default' }, { template: 'wevu' }])

    await writeSmokeReport(report, file, { complete: true })
    expect(await readReport(file)).toMatchObject({ complete: true, summary: { status: 'passed', productFailures: 0 } })
  })

  it('retains the sanitized failure and incremental report while directory deletion is still pending', async () => {
    const { root, file } = await createReportFile()
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {})
    const report = { registries: [], results: [], failures: [] }
    const failure = {
      registryProfile: 'npmjs',
      scenario: 'npm',
      template: 'default',
      stage: 'install',
      kind: 'product',
      error: reportError(new Error(`Timed out after 600000ms\n${path.join(root, 'project', 'npm-debug.log')}`), [root]),
    }
    recordSmokeFailure(report, failure)
    await writeSmokeReport(report, file)

    const deletion = Promise.withResolvers<void>()
    vi.spyOn(fs, 'rm').mockImplementationOnce(() => deletion.promise)
    const cleanup = cleanupSmokeDirectory(root)
    try {
      expect(stderr).toHaveBeenCalledExactlyOnceWith(`[npmjs/npm/default/install/product] ${failure.error}`)
      expect(stderr.mock.calls.flat().join('\n')).not.toContain(root)
      expect(await readReport(file)).toMatchObject({ complete: false, failures: [failure], summary: { status: 'in-progress', productFailures: 1 } })
      expect(stdout).toHaveBeenCalledExactlyOnceWith('[smoke-cleanup] {"event":"begin"}')
    }
    finally {
      deletion.resolve()
      await cleanup
    }

    expect(stderr).toHaveBeenCalledTimes(1)
    expect(stdout.mock.calls.flat().join('\n')).not.toContain(root)
    expect(JSON.parse(String(stdout.mock.calls[1]![0]).replace('[smoke-cleanup] ', ''))).toMatchObject({ event: 'end', complete: true, elapsedMs: expect.any(Number) })
    await writeSmokeReport(report, file, { complete: true })
    expect((await readReport(file)).summary).toMatchObject({ status: 'product-failure', productFailures: 1 })
  })

  it('reports unsuccessful cleanup duration while preserving the original deletion error', async () => {
    const { root } = await createReportFile()
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {})
    const failure = new Error('owned temporary directory could not be removed')
    vi.spyOn(fs, 'rm').mockRejectedValueOnce(failure)

    await expect(cleanupSmokeDirectory(root)).rejects.toBe(failure)
    expect(stdout).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(stdout.mock.calls[1]![0]).replace('[smoke-cleanup] ', ''))).toMatchObject({ event: 'end', complete: false, elapsedMs: expect.any(Number) })
    expect(stdout.mock.calls.flat().join('\n')).not.toContain(root)
  })
})
