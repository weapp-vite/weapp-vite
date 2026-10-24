import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureCapabilityFallbackFailure } from '../ide/statefulHmrDom/capabilityFallbackDiagnostics'
import { captureCapabilityRuntime } from '../ide/statefulHmrDom/capabilityFallbackRuntime'
import { ACCEPTANCE_REPORT_DIR_ENV } from '../scripts/domAcceptanceReport/helpers'
import { appendIdeReportEvent, resolveIdeWarningReportPathsFromEnv } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveIdeWarningReportPathsFromEnv: vi.fn() }))
vi.mock('../ide/statefulHmrDom/capabilityFallbackRuntime', async (original) => {
  const actual = await original<typeof import('../ide/statefulHmrDom/capabilityFallbackRuntime')>()
  return { ...actual, captureCapabilityRuntime: vi.fn(async () => ({ frame: { status: 'fulfilled' }, appFunction: { status: 'fulfilled' }, nativeContext: { status: 'fulfilled' } })) }
})

interface DiagnosticReport {
  failure: { name: string, message: string }
  lastObservation: unknown
  files: Array<{ file: string, observation: { status: string, value?: { artifact: string, bytes: number, sha256: string }, error?: { message: string } } }>
  devOutput: { value: { combined: { artifact: string }, receiptCount: number } }
}

let temporaryRoot: string
let projectRoot: string
let reportRoot: string

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(appendIdeReportEvent).mockReset()
  vi.stubEnv(ACCEPTANCE_REPORT_DIR_ENV, '')
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'capability-fallback-diagnostic-'))
  projectRoot = path.join(temporaryRoot, 'fixture')
  reportRoot = path.join(temporaryRoot, 'reports')
  await mkdir(projectRoot)
  vi.mocked(resolveIdeWarningReportPathsFromEnv).mockReturnValue({ reportDir: reportRoot, reportSlug: 'owned-run', eventLogPath: path.join(reportRoot, 'events.jsonl'), reportJsonPath: path.join(reportRoot, 'index.json'), reportMarkdownPath: path.join(reportRoot, 'index.md') })
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(temporaryRoot, { recursive: true, force: true })
})

async function fixtureFile(file: string, bytes: string | Uint8Array) {
  const target = path.join(projectRoot, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)
}

async function capture() {
  const result = await captureCapabilityFallbackFailure({
    projectRoot,
    miniProgram: {},
    provider: 'devtools',
    scenario: { host: 'wv', requested: 'auto', reason: 'config-json', marker: 'FALLBACK-A' },
    failure: new Error('original state assertion failed'),
    lastObservation: { marker: 'STATEFUL-NATIVE-BASE', identity: 'before-fallback' },
    getDevOutput: () => 'dev stdout\n[native-publication] {"boundary":"native-byte-write"}\r\ndev stderr\n',
    caseDeadlineAtMonotonicMs: performance.now() + 600_000,
  })
  if (result.status !== 'captured' || !result.artifact) {
    throw new Error(`Unexpected diagnostic result: ${JSON.stringify(result)}`)
  }
  const reportFile = path.join(reportRoot, result.artifact)
  const report = JSON.parse(await readFile(reportFile, 'utf8')) as DiagnosticReport
  return { result, directory: path.dirname(reportFile), report }
}

describe('capability fallback failure evidence archive', () => {
  it.each([15_000, 14_999, 0, -1])('skips without runtime or filesystem work with %i milliseconds remaining in the original case', async (remainingMs) => {
    vi.spyOn(performance, 'now').mockReturnValue(40_000)
    const getDevOutput = vi.fn(() => '')
    const result = await captureCapabilityFallbackFailure({
      projectRoot,
      miniProgram: {},
      provider: 'devtools',
      scenario: {},
      failure: new Error('original assertion failure'),
      lastObservation: {},
      getDevOutput,
      caseDeadlineAtMonotonicMs: 40_000 + remainingMs,
    })
    expect(result).toEqual({ status: 'skipped', reason: 'insufficient-case-time', remainingMs })
    expect(resolveIdeWarningReportPathsFromEnv).not.toHaveBeenCalled()
    expect(captureCapabilityRuntime).not.toHaveBeenCalled()
    expect(getDevOutput).not.toHaveBeenCalled()
    expect(appendIdeReportEvent).not.toHaveBeenCalled()
    await expect(readdir(reportRoot)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains original fixture/profile bytes, hashes, private config on disk and the complete merged dev output', async () => {
    const profile = Buffer.from('{"phase":"native-write"}\r\n')
    const source = Buffer.from([0xEF, 0xBB, 0xBF, 0x61, 0x0D, 0x0A])
    const privateConfig = '{"setting":{"compileHotReLoad":false}}\r\n'
    await fixtureFile('.tmp/hmr-profile.jsonl', profile)
    await fixtureFile('src/pages/native/index.ts', source)
    await fixtureFile('project.private.config.json', privateConfig)
    await fixtureFile('dist/pages/native/index.js', 'Page({data:{marker:"FALLBACK-A"}})\n')
    await fixtureFile('node_modules/foreign.js', 'not owned source evidence')
    const { directory, report } = await capture()
    expect(await readFile(path.join(directory, 'files/.tmp/hmr-profile.jsonl'))).toEqual(profile)
    expect(await readFile(path.join(directory, 'files/src/pages/native/index.ts'))).toEqual(source)
    expect(await readFile(path.join(directory, 'files/project.private.config.json'), 'utf8')).toBe(privateConfig)
    expect(report.files.find(item => item.file === '.tmp/hmr-profile.jsonl')).toMatchObject({ observation: { status: 'fulfilled', value: { bytes: profile.length, sha256: createHash('sha256').update(profile).digest('hex') } } })
    expect(report.files.some(item => item.file.startsWith('node_modules/'))).toBe(false)
    expect(await readFile(path.join(directory, report.devOutput.value.combined.artifact), 'utf8')).toBe('dev stdout\n[native-publication] {"boundary":"native-byte-write"}\r\ndev stderr\n')
    expect(report.devOutput.value.receiptCount).toBe(1)
    expect(await readFile(path.join(directory, 'native-publication.log'), 'utf8')).toBe('[native-publication] {"boundary":"native-byte-write"}\n')
    expect(report.failure).toEqual({ name: 'Error', message: 'original state assertion failed' })
    expect(report.lastObservation).toEqual({ marker: 'STATEFUL-NATIVE-BASE', identity: 'before-fallback' })
    expect(captureCapabilityRuntime).toHaveBeenCalledExactlyOnceWith({}, 'devtools')
    expect((await readdir(path.join(reportRoot, 'diagnostics')))).toHaveLength(1)
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ channel: 'hmr-capability-failure', text: expect.stringContaining('diagnostics/capability-fallback-') }))
  })

  it('refuses a symlinked source directory instead of archiving another project\'s files', async () => {
    const foreign = path.join(temporaryRoot, 'foreign')
    await mkdir(foreign)
    await writeFile(path.join(foreign, 'index.ts'), 'foreign source must stay outside this report')
    await mkdir(path.join(projectRoot, 'src/pages'), { recursive: true })
    await symlink(foreign, path.join(projectRoot, 'src/pages/native'), 'junction')
    const { directory, report } = await capture()
    expect(report.files.find(item => item.file === 'src/pages/native/index.ts')).toMatchObject({ observation: { status: 'rejected', error: { message: expect.stringContaining('Refusing non-owned or non-regular diagnostic path') } } })
    await expect(readFile(path.join(directory, 'files/src/pages/native/index.ts'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(foreign, 'index.ts'), 'utf8')).toBe('foreign source must stay outside this report')
  })

  it('retains the original failure when publishing the report event also fails', async () => {
    vi.mocked(appendIdeReportEvent).mockImplementation(() => {
      throw new Error('secondary report event failure')
    })
    const { result, report } = await capture()
    expect(result.status).toBe('captured')
    expect(report.failure.message).toBe('original state assertion failed')
  })

  it('returns a secondary diagnostic error when no current report exists, even if stdout also fails', async () => {
    vi.mocked(resolveIdeWarningReportPathsFromEnv).mockReturnValue(null)
    vi.mocked(process.stdout.write).mockImplementation(() => {
      throw new Error('secondary stdout failure')
    })
    const result = await captureCapabilityFallbackFailure({ projectRoot, miniProgram: {}, provider: 'headless', scenario: {}, failure: new Error('original'), lastObservation: {}, getDevOutput: () => '', caseDeadlineAtMonotonicMs: performance.now() + 600_000 })
    expect(result).toMatchObject({ status: 'failed', error: { message: expect.stringContaining('existing report directory') } })
    expect(captureCapabilityRuntime).not.toHaveBeenCalled()
  })
})
