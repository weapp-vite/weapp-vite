import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { appendIdeReportEvent } from './ideWarningReport'
import { createIssue1015HmrDiagnostics } from './issue1015HmrDiagnostics'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

const directories: string[] = []

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(appendIdeReportEvent).mockReset()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function fixture(devOutput = '') {
  const project = await mkdtemp(path.join(os.tmpdir(), 'issue1015-diagnostics-'))
  directories.push(project)
  const stylesheetPath = path.join(project, 'dist/pages/issue-1015/index.wxss')
  const profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
  await mkdir(path.dirname(stylesheetPath), { recursive: true })
  await mkdir(path.dirname(profilePath), { recursive: true })
  await writeFile(stylesheetPath, '.issue1015-page { color: red; }')
  const options = {
    stylesheetPath,
    projectPath: project,
    captureOutput: vi.fn(async (_label: string) => {}),
    captureRuntime: vi.fn(async (_label: string) => {}),
    getDevOutput: () => devOutput,
  }
  return { project, profilePath, options, diagnostics: createIssue1015HmrDiagnostics(options) }
}

it('retains publication provenance while sanitizing escaped Windows paths and credentials in every evidence sink', async () => {
  const windowsSource = path.win32.join('C:\\Users', 'diagnostic-person', 'workspace', 'src/pages/index.vue')
  const secret = 'private-profile-credential'
  const email = 'diagnostic-person@example.invalid'
  const output = `changed ${windowsSource} token=${secret} ${email}`
  const { project, profilePath, diagnostics } = await fixture(output)
  await writeFile(profilePath, [
    JSON.stringify({
      eventId: 'startup-create',
      batchId: 'initial-batch',
      event: 'create',
      file: windowsSource,
      relativeFile: 'src/pages/index.vue',
      sourceEvents: [{ eventId: 'source-event', event: 'create', file: path.join(project, 'src/app.vue') }],
      metadata: { token: secret, authorization: `Bearer ${secret}`, email },
    }),
    `{"file":${JSON.stringify(windowsSource)},"token":"${secret}","email":"${email}",`,
  ].join('\r\n'))
  await diagnostics.captureFirstStyleOnly()
  const snapshot = await diagnostics.captureFailure('style-only-scripts-failed', {})

  expect(snapshot.profile).toMatchObject({ fileName: '.tmp/hmr-profile.jsonl', truncated: false, error: null })
  const lines = snapshot.profile?.lines ?? []
  expect(lines).toHaveLength(2)
  const record: unknown = JSON.parse(lines[0]!)
  expect(record).toMatchObject({
    eventId: 'startup-create',
    batchId: 'initial-batch',
    event: 'create',
    relativeFile: 'src/pages/index.vue',
    sourceEvents: [{ eventId: 'source-event', event: 'create', file: '<project>/src/app.vue' }],
    metadata: { token: '<redacted>', authorization: '<redacted>', email: '<email>' },
  })
  expect(snapshot.firstStyleOnly?.sha256).toBe(snapshot.stylesheet.sha256)
  expect(appendIdeReportEvent).toHaveBeenCalledOnce()
  const report = vi.mocked(appendIdeReportEvent).mock.calls[0]![0]
  const emitted = `${JSON.stringify(snapshot)}\n${report.text}\n${vi.mocked(process.stdout.write).mock.calls.map(([value]) => String(value)).join('\n')}`
  expect(emitted).toContain('startup-create')
  expect(emitted).toContain('source-event')
  for (const privateValue of [project, 'diagnostic-person', secret, email, 'C:\\Users', 'C:/Users']) {
    expect(emitted).not.toContain(privateValue)
  }
})

it('captures a bounded tail of complete profile records without retaining an oversized partial first record', async () => {
  const { profilePath, diagnostics } = await fixture()
  const records = Array.from({ length: 30 }, (_, index) => ({ eventId: `event-${index}`, event: 'update', relativeFile: `src/page-${index}.vue` }))
  await writeFile(profilePath, [
    JSON.stringify({ eventId: 'discarded-oversized-record', payload: 'x'.repeat(70 * 1024) }),
    ...records.map(record => JSON.stringify(record)),
  ].join('\n'))

  const { profile } = await diagnostics.captureFailure('bounded-profile', {})
  expect(profile).toMatchObject({ truncated: true, error: null })
  expect(profile!.bytes).toBeGreaterThan(profile!.capturedBytes)
  expect(profile!.capturedBytes).toBeLessThanOrEqual(64 * 1024)
  expect(profile!.lines).toHaveLength(24)
  const captured: unknown[] = profile!.lines.map(line => JSON.parse(line) as unknown)
  expect(captured[0]).toMatchObject({ eventId: 'event-6' })
  expect(captured.at(-1)).toMatchObject({ eventId: 'event-29' })
  expect(JSON.stringify(profile)).not.toContain('discarded-oversized-record')
})

it('rethrows the original matcher error when the profile is missing and all optional diagnostic sinks fail', async () => {
  const { options } = await fixture()
  options.captureOutput.mockRejectedValue(new Error('private output detail'))
  options.captureRuntime.mockRejectedValue(new TypeError('private runtime detail'))
  vi.mocked(appendIdeReportEvent).mockImplementation(() => {
    throw new Error('private report detail')
  })
  vi.mocked(process.stdout.write).mockImplementation(() => {
    throw new Error('private stdout detail')
  })
  const diagnostics = createIssue1015HmrDiagnostics(options)
  const failure = new Error('unrelated script mtime changed')

  await expect(diagnostics.rethrowFailure('style-only-scripts-failed', {}, failure)).rejects.toBe(failure)

  expect(options.captureOutput).toHaveBeenCalledOnce()
  expect(options.captureRuntime).toHaveBeenCalledOnce()
  const report = vi.mocked(appendIdeReportEvent).mock.calls[0]![0]
  const snapshot: unknown = JSON.parse(String(report.text))
  expect(snapshot).toMatchObject({
    label: 'style-only-scripts-failed',
    profile: { fileName: '.tmp/hmr-profile.jsonl', lines: [], error: { code: 'ENOENT' } },
    errors: [{ phase: 'output', name: 'Error' }, { phase: 'runtime', name: 'TypeError' }],
  })
  expect(report.text).not.toContain('private')
})
