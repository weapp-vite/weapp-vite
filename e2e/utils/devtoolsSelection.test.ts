import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertSelectedWechatDevtoolsRuntime, preflightSelectedWechatDevtools, readOfficialStableVersion } from './devtoolsSelection'

const { resolveTarget, assertHost } = vi.hoisted(() => ({ resolveTarget: vi.fn(), assertHost: vi.fn() }))
vi.mock('weapp-ide-cli', () => ({ resolveWechatDevtoolsTarget: resolveTarget, assertWechatDevtoolsHost: assertHost }))
const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile', version: '2.02.2608080', channel: 'stable' as const }

describe('selected DevTools preflight', () => {
  beforeEach(() => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', 'selected-cli')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'other-cli')
    resolveTarget.mockResolvedValue(target)
    assertHost.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ channels: [{ id: 'stable', version: target.version }] }) }))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('pins the process CLI and checks both official channel and running host', async () => {
    expect(await preflightSelectedWechatDevtools()).toBe(target)
    expect(process.env.WEAPP_IDE_CLI_PATH).toBe('selected-cli')
    expect(assertHost).toHaveBeenCalledWith(target)
  })

  it.each([{ ...target, channel: 'rc' }, { ...target, version: '2.02.2608070' }])('rejects a different channel or stable version', async (selected) => {
    resolveTarget.mockResolvedValue(selected)
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_STABLE_REQUIRED')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('does not treat unavailable official evidence as permission to continue', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('offline')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('rejects missing stable metadata', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ channels: [{ id: 'rc', version: target.version }] })))
    await expect(readOfficialStableVersion()).rejects.toThrow('缺少有效 Stable')
  })

  it('does not accept matching versions when another installation owns the host', async () => {
    assertHost.mockRejectedValue(new Error('DEVTOOLS_INSTALLATION_MISMATCH'))
    const toolInfo = vi.fn()
    await expect(assertSelectedWechatDevtoolsRuntime(target, { toolInfo })).rejects.toThrow('DEVTOOLS_INSTALLATION_MISMATCH')
    expect(toolInfo).not.toHaveBeenCalled()
  })

  it('compares actual runtime version after connecting', async () => {
    await expect(assertSelectedWechatDevtoolsRuntime(target, { toolInfo: async () => ({ version: 'other-version' }) })).rejects.toThrow('DEVTOOLS_INSTALLATION_MISMATCH')
    await expect(assertSelectedWechatDevtoolsRuntime(target, { toolInfo: async () => ({ version: target.version, SDKVersion: '3.17.3' }) })).resolves.toBeUndefined()
  })
})
