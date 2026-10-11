import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listWechatDevtoolsInstallations, registerWechatDevtoolsInstallation, resolveWechatDevtoolsTarget, unregisterWechatDevtoolsInstallation, withWechatDevtoolsSelection } from '../src/devtoolsTarget'
import { readWechatDevtoolsRegistry } from '../src/devtoolsTarget/registry'
import { createDevtoolsInstallation, createPackageAsar } from './helpers/devtoolsTarget'

const { readConfig, defaultPath, registryCommand } = vi.hoisted(() => ({ readConfig: vi.fn(), defaultPath: vi.fn(), registryCommand: vi.fn() }))
vi.mock('../src/config/custom', () => ({ readCustomConfig: readConfig }))
vi.mock('../src/config/resolver', () => ({ getConfig: async () => ({ cliPath: '' }) }))
vi.mock('../src/runtime/platform', () => ({ getDefaultCliPath: defaultPath }))
vi.mock('execa', () => ({ execa: registryCommand }))
let root: string
beforeEach(async () => {
  readConfig.mockReset().mockResolvedValue({})
  defaultPath.mockReset().mockResolvedValue(undefined)
  registryCommand.mockReset().mockResolvedValue({ exitCode: 0, stdout: '[]' })
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-selection-')))
  for (const key of ['WEAPP_IDE_CLI_PATH', 'WEAPP_IDE_DEVTOOLS_CHANNEL', 'WEAPP_IDE_DEVTOOLS_VERSION', 'WEAPP_IDE_REQUIRE_OFFICIAL_LATEST']) {
    vi.stubEnv(key, undefined)
  }
})
afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await fs.rm(root, { recursive: true, force: true })
})
function options() {
  return { searchRoots: [root], registryPath: path.join(root, 'registry.json'), platform: 'darwin' as const, homeDir: root }
}

describe('installed DevTools selection', () => {
  it('defaults to the latest local Stable, ignoring newer RC and nightly, without network access', async () => {
    await createDevtoolsInstallation(root, { name: 'older.app', version: '2.02.9' })
    await createDevtoolsInstallation(root, { name: 'renamed.app', version: '2.02.10' })
    await createDevtoolsInstallation(root, { name: 'rc.app', version: '2.02.20', versionType: '1' })
    await createDevtoolsInstallation(root, { name: 'nightly.app', version: '2.02.30', versionType: '2' })
    const fetch = vi.fn(() => {
      throw new Error('offline')
    })
    vi.stubGlobal('fetch', fetch)
    expect(await resolveWechatDevtoolsTarget(options())).toMatchObject({ version: '2.02.10', channel: 'stable' })
    expect(await resolveWechatDevtoolsTarget({ ...options(), devtoolsChannel: 'nightly' })).toMatchObject({ version: '2.02.30', channel: 'nightly' })
    expect(await resolveWechatDevtoolsTarget({ ...options(), devtoolsVersion: '2.02.9' })).toMatchObject({ version: '2.02.9' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('lets request selectors override inherited pins but rejects same-level conflicts', async () => {
    const stable = await createDevtoolsInstallation(root)
    await createDevtoolsInstallation(root, { name: 'other.app', versionType: '2' })
    vi.stubEnv('WEAPP_IDE_CLI_PATH', stable.cliPath)
    expect((await resolveWechatDevtoolsTarget({ ...options(), devtoolsChannel: 'nightly' })).channel).toBe('nightly')
    await expect(resolveWechatDevtoolsTarget({ ...options(), cliPath: stable.cliPath, devtoolsChannel: 'nightly' })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
  })
  it('prioritizes environment selection over the legacy config and preserves caller options', async () => {
    const stable = await createDevtoolsInstallation(root)
    await createDevtoolsInstallation(root, { name: 'nightly.app', versionType: '2' })
    readConfig.mockResolvedValue({ cliPath: stable.cliPath })
    expect((await resolveWechatDevtoolsTarget(options())).channel).toBe('stable')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_CHANNEL', 'nightly')
    expect((await resolveWechatDevtoolsTarget(options())).channel).toBe('nightly')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', stable.cliPath)
    await expect(resolveWechatDevtoolsTarget(options())).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
    const selection = Object.freeze({ ...options(), devtoolsChannel: 'stable' as const })
    expect((await resolveWechatDevtoolsTarget(selection)).channel).toBe('stable')
    expect(selection).not.toHaveProperty('requireOfficialLatest')
  })

  it('deduplicates symlink aliases and rejects two distinct installations of the latest version', async () => {
    const stable = await createDevtoolsInstallation(root)
    await fs.symlink(stable.application, path.join(root, 'alias.app'), process.platform === 'win32' ? 'junction' : 'dir')
    expect((await listWechatDevtoolsInstallations(options())).filter(entry => entry.target)).toHaveLength(1)
    await createDevtoolsInstallation(root, { name: 'copy.app' })
    await expect(resolveWechatDevtoolsTarget(options())).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_AMBIGUOUS' })
    expect((await resolveWechatDevtoolsTarget({ ...options(), cliPath: stable.cliPath })).cliPath).toBe(stable.cliPath)
  })
  it('omits unrelated auto-discovered products while preserving invalid explicit registrations', async () => {
    const stable = await createDevtoolsInstallation(root)
    const unrelated = await createDevtoolsInstallation(root, { name: 'other-editor.app' })
    const broken = await createDevtoolsInstallation(root, { name: 'broken.app' })
    await fs.rm(broken.appPath)
    await fs.writeFile(unrelated.appPath, createPackageAsar({ name: 'Other Editor', version: '99.0.0', versionType: '0' }))
    expect(await listWechatDevtoolsInstallations(options())).toEqual([expect.objectContaining({ cliPath: stable.cliPath, target: expect.any(Object) })])
    await fs.writeFile(options().registryPath, JSON.stringify([unrelated.cliPath, broken.cliPath]))
    expect(await listWechatDevtoolsInstallations(options())).toContainEqual(expect.objectContaining({ cliPath: unrelated.cliPath, error: expect.stringContaining('does not identify WeChat DevTools') }))
    expect(await listWechatDevtoolsInstallations(options())).toContainEqual(expect.objectContaining({ cliPath: broken.cliPath, error: expect.any(String) }))
  })

  it('keeps concurrent command contexts isolated and rejects changing a frozen installation', async () => {
    const stable = await createDevtoolsInstallation(root)
    const nightly = await createDevtoolsInstallation(root, { name: 'other.app', versionType: '2' })
    const channels = await Promise.all([stable, nightly].map(installation => withWechatDevtoolsSelection({ ...options(), cliPath: installation.cliPath }, async (target) => {
      await Promise.resolve()
      expect(await resolveWechatDevtoolsTarget()).toBe(target)
      await expect(resolveWechatDevtoolsTarget({ devtoolsChannel: target.channel === 'stable' ? 'nightly' : 'stable' })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
      return target.channel
    })))
    expect(channels).toEqual(['stable', 'nightly'])
  })

  it('rejects a conflicting fixed target inside an active operation', async () => {
    const stable = await createDevtoolsInstallation(root)
    const nightly = await createDevtoolsInstallation(root, { name: 'nightly.app', versionType: '2' })
    const other = await resolveWechatDevtoolsTarget({ ...options(), cliPath: nightly.cliPath })
    await withWechatDevtoolsSelection({ ...options(), cliPath: stable.cliPath }, async () => {
      await expect(resolveWechatDevtoolsTarget({ target: other })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
    })
  })

  it('discovers Windows CLI files with spaces and Chinese paths', async () => {
    const selected = await createDevtoolsInstallation(root, { platform: 'win32', name: 'Tencent/微信 开发者工具 nightly', versionType: '2' })
    expect(await resolveWechatDevtoolsTarget({ ...options(), platform: 'win32', devtoolsChannel: 'nightly' })).toMatchObject({ cliPath: selected.cliPath, channel: 'nightly' })
  })
  it('uses Windows registry locations and common directories even if registry access fails', async () => {
    const selected = await createDevtoolsInstallation(root, { platform: 'win32', name: 'custom/deep/微信 RC', versionType: '1' })
    const programFiles = path.join(root, 'programFiles')
    vi.stubEnv('ProgramFiles', programFiles)
    vi.stubEnv('ProgramFiles(x86)', path.join(root, 'empty'))
    vi.stubEnv('LOCALAPPDATA', path.join(root, 'local'))
    const nativeOptions = { platform: 'win32' as const, registryPath: path.join(root, 'registry.json'), homeDir: root }
    registryCommand.mockResolvedValue({ exitCode: 0, stdout: JSON.stringify(path.dirname(selected.cliPath)) })
    expect(await resolveWechatDevtoolsTarget({ ...nativeOptions, devtoolsChannel: 'rc' })).toMatchObject({ cliPath: selected.cliPath, channel: 'rc' })
    expect(registryCommand).toHaveBeenCalledWith('powershell.exe', expect.any(Array), expect.objectContaining({ windowsHide: true }))
    const stable = await createDevtoolsInstallation(programFiles, { platform: 'win32', name: 'Tencent/微信 Stable' })
    registryCommand.mockRejectedValue(new Error('registry unavailable'))
    expect(await resolveWechatDevtoolsTarget(nativeOptions)).toMatchObject({ cliPath: stable.cliPath, channel: 'stable' })
  })
  it('uses registered explicit Linux paths without searching for a community launcher', async () => {
    const selected = await createDevtoolsInstallation(root, { platform: 'win32' })
    const registryPath = path.join(root, 'registry.json')
    await fs.writeFile(registryPath, JSON.stringify([selected.cliPath]))
    expect(await resolveWechatDevtoolsTarget({ platform: 'linux', registryPath, homeDir: root })).toMatchObject({ cliPath: selected.cliPath })
    expect(defaultPath).not.toHaveBeenCalled()
    expect(registryCommand).not.toHaveBeenCalled()
  })

  it('registers only paths, reads updated metadata, and removes missing registrations', async () => {
    const selected = await createDevtoolsInstallation(root, { platform: process.platform === 'darwin' ? 'darwin' : 'win32' })
    const registryPath = path.join(root, 'registered.json')
    await registerWechatDevtoolsInstallation(selected.cliPath, registryPath)
    expect(await readWechatDevtoolsRegistry(registryPath)).toEqual([selected.cliPath])
    await fs.rm(selected.application, { recursive: true })
    const entries = await listWechatDevtoolsInstallations({ ...options(), registryPath })
    expect(entries).toEqual([expect.objectContaining({ cliPath: selected.cliPath, error: expect.any(String) })])
    await unregisterWechatDevtoolsInstallation(selected.cliPath, registryPath)
    expect(await readWechatDevtoolsRegistry(registryPath)).toEqual([])
  })

  it('only enforces the official latest version when explicitly requested', async () => {
    await createDevtoolsInstallation(root)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ channels: [{ id: 'stable', version: '2.02.9999999' }] }) }))
    await expect(resolveWechatDevtoolsTarget({ ...options(), requireOfficialLatest: true })).rejects.toThrow('DEVTOOLS_OFFICIAL_LATEST_REQUIRED')
  })
})
