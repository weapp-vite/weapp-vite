import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDevtoolsInstallation, createPackageAsar } from '../../test/helpers/devtoolsTarget'
import { resolveWechatDevtoolsTarget, withWechatDevtoolsSelection } from '../devtoolsTarget'
import { inspectWechatDevtoolsInstallation } from '../devtoolsTarget/installation'
import { assertManagedInstallation } from './host'

let directory: string
let target: ResolvedWechatDevtoolsTarget
let offline: TypeError
const request = vi.fn<typeof fetch>()

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-owned-installation-'))
  const installation = await createDevtoolsInstallation(directory, {
    platform: process.platform === 'darwin' ? 'darwin' : 'win32',
  })
  target = await inspectWechatDevtoolsInstallation(installation.cliPath)
  offline = new TypeError('fetch failed', { cause: Object.assign(new Error('network unavailable'), { code: 'ENOTFOUND' }) })
  request.mockReset().mockRejectedValue(offline)
  vi.stubGlobal('fetch', request)
  vi.stubEnv('WEAPP_IDE_REQUIRE_OFFICIAL_LATEST', '1')
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await fs.rm(directory, { recursive: true, force: true })
})

describe('managed frozen installation verification', () => {
  it('verifies the frozen local installation offline without repeating strict official selection', async () => {
    await expect(assertManagedInstallation(target)).resolves.toBeUndefined()
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps strict selection dependent on fresh official evidence', async () => {
    await expect(resolveWechatDevtoolsTarget({ cliPath: target.cliPath })).rejects.toBe(offline)
    expect(request).toHaveBeenCalledOnce()
  })

  it.each(['installationId', 'appPath', 'profileDir', 'version', 'channel'] as const)('rejects frozen %s drift while offline', async (key) => {
    const previous = {
      ...target,
      [key]: key === 'channel' ? 'nightly' : `${target[key]}-different`,
    } as ResolvedWechatDevtoolsTarget
    await expect(assertManagedInstallation(previous)).rejects.toThrow('installation changed')
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects a different local CLI without querying official metadata', async () => {
    const other = await createDevtoolsInstallation(directory, {
      name: 'other.app',
      platform: process.platform === 'darwin' ? 'darwin' : 'win32',
    })
    await expect(assertManagedInstallation({ ...target, cliPath: other.cliPath })).rejects.toThrow('installation changed')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    { version: '2.02.9999999', versionType: '0' },
    { version: '2.02.2608080', versionType: '1' },
  ])('rereads changed metadata inside an active frozen selection: %j', async (replacement) => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ channels: [{ id: 'stable', version: target.version }] })))
    await withWechatDevtoolsSelection({ cliPath: target.cliPath }, async (selected) => {
      expect(selected).toEqual(target)
      await fs.writeFile(target.appPath, createPackageAsar({ name: '微信开发者工具', ...replacement }))
      await expect(assertManagedInstallation(selected)).rejects.toThrow('installation changed')
    })
    expect(request).toHaveBeenCalledOnce()
  })
})
