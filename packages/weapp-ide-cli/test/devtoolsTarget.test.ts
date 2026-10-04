import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveWechatDevtoolsTarget } from '../src/devtoolsTarget'
import { createDevtoolsInstallation, createPackageAsar } from './helpers/devtoolsTarget'

const getConfig = vi.hoisted(() => vi.fn())
vi.mock('../src/config/resolver', () => ({ getConfig }))
const directories: string[] = []
async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-target-'))
  directories.push(root)
  return await fs.realpath(root)
}
afterEach(async () => {
  getConfig.mockReset()
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

describe('DevTools installation resolution', () => {
  it('reads the product ASAR version, keeps installations separate, and resolves aliases together', async () => {
    const root = await fixtureRoot()
    const first = await createDevtoolsInstallation(root)
    const second = await createDevtoolsInstallation(root, { name: 'other.app', versionType: '1' })
    const alias = path.join(root, 'alias.app')
    await fs.symlink(first.application, alias, process.platform === 'win32' ? 'junction' : 'dir')
    const options = { platform: 'darwin' as const, homeDir: root }
    const selected = await resolveWechatDevtoolsTarget({ ...options, cliPath: first.cliPath })
    expect(selected).toMatchObject({ version: '2.02.2608080', channel: 'stable', appPath: first.appPath })
    expect(selected.profileDir).toBe(path.join(root, 'Library', 'Application Support', '微信开发者工具', createHash('md5').update(first.appPath).digest('hex')))
    expect(await resolveWechatDevtoolsTarget({ ...options, cliPath: path.join(alias, 'Contents', 'MacOS', 'cli') })).toEqual(selected)
    const other = await resolveWechatDevtoolsTarget({ ...options, cliPath: second.cliPath })
    expect(other.channel).toBe('rc')
    expect(other.installationId).not.toBe(selected.installationId)
    expect(other.profileDir).not.toBe(selected.profileDir)
    expect(getConfig).not.toHaveBeenCalled()
  })

  it('uses the same configured CLI when no explicit selection is supplied', async () => {
    const root = await fixtureRoot()
    const { cliPath } = await createDevtoolsInstallation(root)
    getConfig.mockResolvedValue({ cliPath })
    expect((await resolveWechatDevtoolsTarget({ platform: 'darwin', homeDir: root })).cliPath).toBe(cliPath)
  })

  it('keeps a frozen target for matching canonical CLI aliases and rejects a different installation', async () => {
    const root = await fixtureRoot()
    const first = await createDevtoolsInstallation(root)
    const second = await createDevtoolsInstallation(root, { name: 'other.app' })
    const target = await resolveWechatDevtoolsTarget({ cliPath: first.cliPath, platform: 'darwin', homeDir: root })
    const alias = path.join(root, 'selected-alias.app')
    await fs.symlink(first.application, alias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(await resolveWechatDevtoolsTarget({ target })).toBe(target)
    expect(await resolveWechatDevtoolsTarget({ target, cliPath: path.join(alias, 'Contents', 'MacOS', 'cli') })).toBe(target)
    await expect(resolveWechatDevtoolsTarget({ target, cliPath: second.cliPath })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
    expect(getConfig).not.toHaveBeenCalled()
  })

  it.each([false, true])('supports the selected Windows installation layout (legacy=%s)', async (legacy) => {
    const root = await fixtureRoot()
    const installed = await createDevtoolsInstallation(root, { platform: 'win32', legacy })
    const localAppDataDir = path.join(root, 'data')
    const selected = await resolveWechatDevtoolsTarget({ cliPath: installed.cliPath, platform: 'win32', homeDir: root, localAppDataDir })
    const base = path.join(localAppDataDir, '微信开发者工具', 'User Data')
    expect(selected.profileDir).toBe(legacy ? base : path.join(base, createHash('md5').update(installed.appPath).digest('hex')))
    expect(selected.version).toBe('2.02.2608080')
  })

  it('fails for missing selected metadata instead of falling back to another installation', async () => {
    const root = await fixtureRoot()
    const selected = await createDevtoolsInstallation(root)
    await fs.rm(selected.appPath)
    await expect(resolveWechatDevtoolsTarget({ cliPath: selected.cliPath, platform: 'darwin' })).rejects.toThrow('Cannot identify')
    expect(getConfig).not.toHaveBeenCalled()
  })

  it.each([{ offset: '9007199254740992' }, { size: 2 * 1024 * 1024 }, { link: '../package.json' }])('rejects malformed ASAR package bounds without evaluating code: %j', async (entry) => {
    const root = await fixtureRoot()
    const selected = await createDevtoolsInstallation(root)
    await fs.writeFile(selected.appPath, createPackageAsar({ version: '2.02.2608080', main: 'throw-if-executed.js' }, entry))
    await expect(resolveWechatDevtoolsTarget({ cliPath: selected.cliPath, platform: 'darwin' })).rejects.toThrow(/ASAR/)
  })
})
