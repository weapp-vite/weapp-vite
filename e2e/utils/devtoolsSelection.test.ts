import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACCEPTED_DEVTOOLS_CHANNEL_ENV,
  ACCEPTED_DEVTOOLS_VERSION_ENV,
  assertSelectedWechatDevtoolsRuntime,
  DEVTOOLS_ACCEPTED_VERSION_ENV,
  DEVTOOLS_OFFICIAL_QUERIED_AT_ENV,
  DEVTOOLS_OFFICIAL_SOURCE_ENV,
  DEVTOOLS_OFFICIAL_VERSION_ENV,
  DEVTOOLS_SELECTED_CHANNEL_ENV,
  DEVTOOLS_SELECTED_VERSION_ENV,
  DEVTOOLS_VERSION_POLICY_ENV,
  preflightSelectedWechatDevtools,
  readDevtoolsVersionPolicy,
  readOfficialStableVersion,
} from './devtoolsSelection'

const { resolveTarget, assertHost } = vi.hoisted(() => ({ resolveTarget: vi.fn(), assertHost: vi.fn() }))
vi.mock('weapp-ide-cli', () => ({ resolveWechatDevtoolsTarget: resolveTarget, assertWechatDevtoolsHost: assertHost }))
const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile', version: '2.02.2608070', channel: 'stable' as const }

describe('selected DevTools preflight', () => {
  beforeEach(() => {
    for (const key of [DEVTOOLS_VERSION_POLICY_ENV, DEVTOOLS_SELECTED_VERSION_ENV, DEVTOOLS_SELECTED_CHANNEL_ENV, DEVTOOLS_OFFICIAL_VERSION_ENV, DEVTOOLS_ACCEPTED_VERSION_ENV, DEVTOOLS_OFFICIAL_SOURCE_ENV, DEVTOOLS_OFFICIAL_QUERIED_AT_ENV]) {
      vi.stubEnv(key, undefined)
    }
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, undefined)
    vi.stubEnv(ACCEPTED_DEVTOOLS_CHANNEL_ENV, undefined)
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
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'official-stable', acceptedVersion: null, officialVersionMatches: true })
  })

  it.each([{ ...target, channel: 'rc' }, { ...target, version: '2.02.2608060' }])('rejects a different channel or stable version', async (selected) => {
    resolveTarget.mockResolvedValue(selected)
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_STABLE_REQUIRED')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('accepts an explicitly selected stable version and records the policy', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, target.version)
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ channels: [{ id: 'stable', version: '2.02.2608080' }] }) } as Response)
    expect(await preflightSelectedWechatDevtools()).toBe(target)
    expect(readDevtoolsVersionPolicy()).toMatchObject({
      mode: 'selected-version-opt-in',
      selectedVersion: target.version,
      selectedChannel: 'stable',
      officialVersion: '2.02.2608080',
      acceptedVersion: target.version,
      officialVersionMatches: false,
    })
  })

  it('accepts a complete DevTools version with an additional numeric segment', async () => {
    const extendedVersion = '2.02.2608070.1'
    resolveTarget.mockResolvedValue({ ...target, version: extendedVersion })
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, extendedVersion)
    expect(await preflightSelectedWechatDevtools()).toMatchObject({ version: extendedVersion })
    expect(readDevtoolsVersionPolicy()).toMatchObject({ selectedVersion: extendedVersion, acceptedVersion: extendedVersion })
  })

  it('rejects an explicitly selected version that differs from the target', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, '2.02.2608060')
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_ACCEPTED_VERSION_MISMATCH')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('rejects an invalid explicitly selected version', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, 'stable')
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow(`${ACCEPTED_DEVTOOLS_VERSION_ENV} must be a complete DevTools version`)
    expect(assertHost).not.toHaveBeenCalled()
  })

  it.each(['rc', 'nightly', undefined])('rejects a %s channel even with an exact version opt-in', async (channel) => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, target.version)
    resolveTarget.mockResolvedValue({ ...target, channel })
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_STABLE_REQUIRED')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it.each(['rc', 'nightly'])('accepts only an explicitly authorized %s channel and exact version', async (channel) => {
    const selected = { ...target, channel }
    resolveTarget.mockResolvedValue(selected)
    vi.stubEnv(ACCEPTED_DEVTOOLS_CHANNEL_ENV, channel)
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, target.version)
    expect(await preflightSelectedWechatDevtools()).toBe(selected)
    expect(assertHost).toHaveBeenCalledWith(selected)
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'selected-version-opt-in', selectedChannel: channel, acceptedVersion: target.version, officialVersionMatches: false })
  })

  it.each(['rc', 'nightly'])('requires an exact version when opting into %s', async (channel) => {
    resolveTarget.mockResolvedValue({ ...target, channel })
    vi.stubEnv(ACCEPTED_DEVTOOLS_CHANNEL_ENV, channel)
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_ACCEPTED_VERSION_REQUIRED')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('rejects a different channel even when the accepted version matches', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_CHANNEL_ENV, 'nightly')
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, target.version)
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('允许渠道为 nightly')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('rejects invalid channel authorization', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_CHANNEL_ENV, 'unknown')
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow(`${ACCEPTED_DEVTOOLS_CHANNEL_ENV} must be stable, rc or nightly`)
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('does not deserialize a non-stable installation as official Stable', async () => {
    await preflightSelectedWechatDevtools()
    vi.stubEnv(DEVTOOLS_SELECTED_CHANNEL_ENV, 'nightly')
    expect(readDevtoolsVersionPolicy()).toBeUndefined()
  })

  it.each([undefined, target.version])('does not treat unavailable official evidence as permission to continue with opt-in %s', async (accepted) => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, accepted)
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('offline')
    expect(assertHost).not.toHaveBeenCalled()
  })

  it('clears old selection evidence before a new failed preflight', async () => {
    await preflightSelectedWechatDevtools()
    expect(readDevtoolsVersionPolicy()).toBeDefined()
    assertHost.mockRejectedValue(new Error('DEVTOOLS_INSTALLATION_MISMATCH'))
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_INSTALLATION_MISMATCH')
    expect(readDevtoolsVersionPolicy()).toBeUndefined()
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
