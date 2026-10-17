import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoRoutesTopologyDiagnostics } from '../e2e/utils/autoRoutesTopologyDiagnostics'

const files = vi.hoisted(() => ({ mkdir: vi.fn(), mkdtemp: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() }))
vi.mock('node:fs/promises', () => files)

const project = path.resolve('diagnostic-fixture')
const profilePath = path.join(project, 'hmr-profile.jsonl')
const rawProfile = `${JSON.stringify({ file: `${project.replaceAll('/', '\\')}\\src\\page.vue`, token: 'private-value' })}\n`

function diagnostics() {
  return createAutoRoutesTopologyDiagnostics({
    project,
    profilePath,
    routes: ['pages/native/index', 'pages/vue/index'],
    getDevOutput: () => `project=${project}\ntoken=private-value`,
  })
}

function writtenFile(name: string) {
  const call = files.writeFile.mock.calls.find(([file]) => String(file).endsWith(name))
  expect(call).toBeDefined()
  return String(call?.[1])
}

interface FailureReport {
  stage: string
  failure: string
  stages: Array<{ stage: string, phase: string }>
  files: Array<{ file: string, exists: boolean | null, originalSha256?: string }>
}

describe('automatic route topology failure evidence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR', path.resolve('diagnostic-artifacts'))
    files.mkdir.mockReset().mockResolvedValue(undefined)
    files.mkdtemp.mockReset().mockImplementation(async (prefix: string) => `${prefix}sample`)
    files.readFile.mockReset().mockImplementation(async (file: string) => {
      if (file === profilePath) {
        return rawProfile
      }
      if (file.endsWith('.json')) {
        return JSON.stringify({ source: project, token: 'private-value' })
      }
      return `source=${project}\ntoken=private-value`
    })
    files.writeFile.mockReset().mockResolvedValue(undefined)
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps stage identity, full profile and route outputs with valid sanitized JSON', async () => {
    const capture = diagnostics()
    capture.record('restored', 'begin')
    capture.record('restored', 'failure')
    await capture.captureFailure('restored', new Error(`publication failed at ${project}`))

    const report = JSON.parse(writtenFile('failure.json')) as FailureReport
    expect(report).toMatchObject({
      stage: 'restored',
      failure: 'publication failed at <project>',
      stages: [{ stage: 'restored', phase: 'begin' }, { stage: 'restored', phase: 'failure' }],
    })
    expect(report.files).toHaveLength(9)
    expect(report.files.find(file => file.file === 'hmr-profile.jsonl')).toMatchObject({
      exists: true,
      originalSha256: createHash('sha256').update(rawProfile).digest('hex'),
    })
    const profile: unknown = JSON.parse(writtenFile('hmr-profile.jsonl'))
    expect(profile).toMatchObject({ file: '<project>/src/page.vue' })
    expect(() => JSON.parse(writtenFile('dist/app.json')) as unknown).not.toThrow()
    const output = files.writeFile.mock.calls.map(([, content]) => String(content)).join('\n')
    expect(output).not.toContain(project)
    expect(output).not.toContain('private-value')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('records absent route outputs separately from the original publication failure', async () => {
    files.readFile.mockRejectedValue(Object.assign(new Error('missing output'), { code: 'ENOENT' }))
    await diagnostics().captureFailure('added', new Error('publication failed'))

    const report = JSON.parse(writtenFile('failure.json')) as FailureReport
    expect(report.failure).toBe('publication failed')
    expect(report.files.every(file => file.exists === false)).toBe(true)
    expect(files.writeFile).toHaveBeenCalledTimes(2)
  })

  it.each(['mkdir', 'mkdtemp', 'readFile', 'writeFile'] as const)('bounds a stalled %s and prevents new stages after the deadline', async (phase) => {
    let finish: ((value: unknown) => void) | undefined
    files[phase].mockReturnValue(new Promise((resolve) => {
      finish = resolve
    }))
    const capture = diagnostics().captureFailure('removed', new Error('publication failed'))

    await vi.advanceTimersByTimeAsync(2_500)
    await expect(capture).resolves.toBeUndefined()
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('diagnostic budget exhausted'))
    const writesAtDeadline = files.writeFile.mock.calls.length
    finish?.(phase === 'mkdtemp' ? path.resolve('diagnostic-artifacts/sample') : '')
    await vi.advanceTimersByTimeAsync(0)
    expect(files.writeFile).toHaveBeenCalledTimes(writesAtDeadline)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps filesystem and log failures from replacing the scenario failure', async () => {
    files.mkdir.mockRejectedValue(new Error('artifact directory unavailable'))
    vi.mocked(process.stdout.write).mockImplementation(() => {
      throw new Error('stdout closed')
    })
    await expect(diagnostics().captureFailure('restored', new Error('publication failed'))).resolves.toBeUndefined()
  })
})
