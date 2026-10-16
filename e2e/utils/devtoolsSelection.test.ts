import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEVTOOLS_SELECTION_ENV_KEYS } from './devtoolsCli'
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
vi.mock('weapp-ide-cli', async importOriginal => ({ ...await importOriginal<typeof import('weapp-ide-cli')>(), resolveWechatDevtoolsTarget: resolveTarget, assertWechatDevtoolsHost: assertHost }))
const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile', version: '2.02.2608070', channel: 'stable' as const }

describe('selected DevTools preflight', () => {
  beforeEach(() => {
    for (const key of [...DEVTOOLS_SELECTION_ENV_KEYS, DEVTOOLS_VERSION_POLICY_ENV, DEVTOOLS_SELECTED_VERSION_ENV, DEVTOOLS_SELECTED_CHANNEL_ENV, DEVTOOLS_OFFICIAL_VERSION_ENV, DEVTOOLS_ACCEPTED_VERSION_ENV, DEVTOOLS_OFFICIAL_SOURCE_ENV, DEVTOOLS_OFFICIAL_QUERIED_AT_ENV, 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_ERROR', 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_CHANNEL']) {
      vi.stubEnv(key, undefined)
    }
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

  it('pins all child commands and records installed Stable as the default policy', async () => {
    expect(await preflightSelectedWechatDevtools()).toBe(target)
    expect(process.env.WEAPP_IDE_CLI_PATH).toBe('selected-cli')
    expect(assertHost).toHaveBeenCalledWith(target)
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'installed-stable', acceptedVersion: null, officialVersionMatches: true })
  })
  it('allows local Stable behind the official gray release', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ channels: [{ id: 'stable', version: '2.02.2608080' }] }) } as Response)
    await expect(preflightSelectedWechatDevtools()).resolves.toBe(target)
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'installed-stable', officialVersionMatches: false })
  })
  it('keeps the exact legacy version pin and validates its metadata', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, target.version)
    await preflightSelectedWechatDevtools()
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'selected-version-opt-in', acceptedVersion: target.version })
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, '2.02.2608060')
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_ACCEPTED_VERSION_MISMATCH')
  })
  it('allows explicit channel opt-in without requiring a separate exact version', async () => {
    resolveTarget.mockResolvedValue({ ...target, channel: 'nightly' })
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', 'nightly')
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ channels: [{ id: 'stable', version: '2.02.2608080' }, { id: 'nightly', version: target.version }] }) } as Response)
    await preflightSelectedWechatDevtools()
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'selected-channel', selectedChannel: 'nightly', officialChannel: 'nightly', officialVersion: target.version, officialVersionMatches: true, acceptedVersion: null })
  })
  it('does not accept mismatched requested channels', async () => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_CHANNEL_ENV, 'nightly')
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('允许渠道为 nightly')
  })
  it.each([undefined, target.version])('records official query failure without blocking local testing (%s)', async (accepted) => {
    vi.stubEnv(ACCEPTED_DEVTOOLS_VERSION_ENV, accepted)
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    await expect(preflightSelectedWechatDevtools()).resolves.toBe(target)
    expect(readDevtoolsVersionPolicy()).toMatchObject({ officialVersion: null, officialError: 'offline', officialVersionMatches: false })
  })
  it.each(['WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST', 'WEAPP_IDE_REQUIRE_OFFICIAL_LATEST'])('blocks outdated Stable and unavailable official evidence only in strict mode (%s)', async (strictEnv) => {
    vi.stubEnv(strictEnv, '1')
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_OFFICIAL_LATEST_REQUIRED')
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ channels: [{ id: 'stable', version: '2.02.2608080' }] }) } as Response)
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_OFFICIAL_LATEST_REQUIRED')
    expect(assertHost).not.toHaveBeenCalled()
  })
  it.each(['WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST', 'WEAPP_IDE_REQUIRE_OFFICIAL_LATEST'])('records a successful explicit strict Stable check (%s)', async (strictEnv) => {
    vi.stubEnv(strictEnv, '1')
    await preflightSelectedWechatDevtools()
    expect(readDevtoolsVersionPolicy()).toMatchObject({ mode: 'official-stable', officialVersionMatches: true })
  })
  it('rejects unknown product metadata', async () => {
    resolveTarget.mockResolvedValue({ ...target, channel: 'unknown' })
    await expect(preflightSelectedWechatDevtools()).rejects.toThrow('DEVTOOLS_VERSION_UNKNOWN')
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
    await expect(readOfficialStableVersion()).rejects.toThrow('no valid stable version')
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
