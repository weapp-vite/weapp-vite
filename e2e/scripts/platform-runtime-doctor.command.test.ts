import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { diagnosePlatformRuntime } from './platform-runtime-doctor'

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }))
vi.mock('execa', () => ({ execa }))

describe('platform doctor command readiness', () => {
  beforeEach(() => {
    execa.mockReset()
    vi.stubEnv('WEAPP_VITE_PLATFORM_DOCTOR_SKIP_DEFAULT_PATHS', '1')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([1, 127, 9009])('does not treat a shell failure exit %s as an available CLI', async (exitCode) => {
    execa.mockResolvedValue({ exitCode })
    expect(await diagnosePlatformRuntime('alipay')).toMatchObject({ ready: false })
  })

  it.each(['ENOENT', 'ETIMEDOUT', 'EACCES'])('does not report a failed %s probe as ready', async (code) => {
    execa.mockRejectedValue(Object.assign(new Error('probe failed'), { code }))
    expect(await diagnosePlatformRuntime('alipay')).toMatchObject({ ready: false })
  })

  it('reports readiness only after a successful version probe', async () => {
    execa.mockResolvedValue({ exitCode: 0 })
    expect(await diagnosePlatformRuntime('alipay')).toMatchObject({ ready: true })
  })

  it('isolates PATH overrides from inherited Windows casing and current-directory lookup', async () => {
    vi.stubEnv('WEAPP_VITE_PLATFORM_DOCTOR_PATH', '')
    vi.stubEnv('Path', 'inherited-cli-directory')
    execa.mockResolvedValue({ exitCode: 1 })
    await diagnosePlatformRuntime('alipay')

    const options = execa.mock.calls[0]?.[2]
    expect(options.extendEnv).toBe(false)
    expect(Object.keys(options.env).filter(key => key.toUpperCase() === 'PATH')).toEqual(['PATH'])
    expect(options.env.PATH).toBe('')
    expect(options.env.NoDefaultCurrentDirectoryInExePath).toBe('1')
  })
})
