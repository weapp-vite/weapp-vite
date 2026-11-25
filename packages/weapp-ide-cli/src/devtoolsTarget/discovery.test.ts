import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/custom', () => ({ readCustomConfig: async () => ({}) }))
vi.mock('./registry', () => ({ readWechatDevtoolsRegistry: async () => [] }))
vi.mock('./installation', () => ({
  inspectWechatDevtoolsInstallation: async (cliPath: string) => ({
    cliPath,
    appPath: cliPath,
    installationId: cliPath,
    profileDir: '',
    version: '2.0.0',
    channel: 'stable',
  }),
}))

const tempRoots: string[] = []

/** 在临时目录里构造“受保护子目录 + 两级深度安装目录”的 Windows 扫描场景。 */
async function createSearchRoot(protectedName: string) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-discovery-'))
  tempRoots.push(root)
  await fsp.mkdir(path.join(root, protectedName))
  const installationDir = path.join(root, 'Tencent', 'wechat-devtools')
  await fsp.mkdir(installationDir, { recursive: true })
  const cliPath = path.join(installationDir, 'cli.bat')
  await fsp.writeFile(cliPath, '@echo off\r\n')
  return { root, cliPath }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  while (tempRoots.length) {
    const target = tempRoots.pop()
    if (target) {
      void fsp.rm(target, { recursive: true, force: true })
    }
  }
})

describe('listWechatDevtoolsInstallations', () => {
  it('继续扫描拒绝列出的受保护目录', async () => {
    vi.stubEnv('WEAPP_IDE_CLI_PATH', '')
    const { root, cliPath } = await createSearchRoot('WindowsApps')
    const readdir = fsp.readdir.bind(fsp) as typeof fsp.readdir
    vi.spyOn(fsp, 'readdir').mockImplementation((async (target: unknown, options?: unknown) => {
      if (path.resolve(String(target)) === path.join(root, 'WindowsApps')) {
        throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
      }
      return readdir(target as never, options as never)
    }) as typeof fsp.readdir)

    const { listWechatDevtoolsInstallations } = await import('./discovery')
    const installations = await listWechatDevtoolsInstallations({ platform: 'win32', searchRoots: [root] })

    expect(installations.map(entry => entry.cliPath)).toContain(cliPath)
  })
})
