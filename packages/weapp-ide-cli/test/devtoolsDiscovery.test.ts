import type { WechatDevtoolsInstallation } from '../src/devtoolsTarget/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listWechatDevtoolsInstallations } from '../src/devtoolsTarget'
import { selectInstalledWechatDevtools } from '../src/devtoolsTarget/discovery'
import { createDevtoolsInstallation } from './helpers/devtoolsTarget'

// 受保护目录与异常目录名由 mock 工厂和用例共享，必须 hoisted 才能在工厂里引用。
const { protectedSegment, brokenSegment, readConfig, defaultPath, registryCommand } = vi.hoisted(() => ({
  protectedSegment: 'protected-scan-root',
  brokenSegment: 'unexpected-scan-root',
  readConfig: vi.fn(),
  defaultPath: vi.fn(),
  registryCommand: vi.fn(),
}))

// 只替换 readdir 的错误形状，其余文件操作沿用真实实现，避免把断言写成 mock 自证。
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const real = ((actual as { default?: typeof import('node:fs/promises') }).default ?? actual) as typeof import('node:fs/promises')
  const readdir: typeof real.readdir = async (...args) => {
    const target = String(args[0] ?? '')
    if (target.includes(protectedSegment)) {
      throw Object.assign(new Error('Permission denied by the directory ACL.'), { code: 'EPERM' })
    }
    if (target.includes(brokenSegment)) {
      throw Object.assign(new Error('Unexpected scanner failure.'), { code: 'ERR_UNEXPECTED_SCANNER' })
    }
    return (real.readdir as (...values: unknown[]) => Promise<never>)(...args)
  }
  const patched = { ...real, readdir }
  return { ...actual, ...patched, default: patched }
})

vi.mock('../src/config/custom', () => ({ readCustomConfig: readConfig }))
vi.mock('../src/runtime/platform', () => ({ getDefaultCliPath: defaultPath }))
vi.mock('execa', () => ({ execa: registryCommand }))

let root: string

beforeEach(async () => {
  readConfig.mockReset().mockResolvedValue({})
  defaultPath.mockReset().mockResolvedValue(undefined)
  registryCommand.mockReset().mockResolvedValue({ exitCode: 0, stdout: '[]' })
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-discovery-')))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

function win32Options(searchRoots: string[] = [path.join(root, 'Program Files')]) {
  return {
    searchRoots,
    registryPath: path.join(root, 'registry.json'),
    platform: 'win32' as const,
    homeDir: root,
  }
}

/** 在 Windows 风格的安装根里放入真实安装与一个 ACL 受保护目录。 */
async function createVendorLayout() {
  const programFiles = path.join(root, 'Program Files')
  const stable = await createDevtoolsInstallation(programFiles, { name: 'Tencent', platform: 'win32' })
  await fs.mkdir(path.join(programFiles, protectedSegment, 'nested'), { recursive: true })
  return { programFiles, stable }
}

describe('wechat devtools candidate scanning', () => {
  it('keeps discovering installations when a scanned directory is not listable on Windows', async () => {
    const { programFiles, stable } = await createVendorLayout()

    const installations = await listWechatDevtoolsInstallations(win32Options([programFiles]))
    const found = installations.filter((entry): entry is WechatDevtoolsInstallation & { target: NonNullable<WechatDevtoolsInstallation['target']> } => !!entry.target)

    expect(found.map(entry => entry.cliPath)).toContain(stable.cliPath)
    expect(found[0]!.target.channel).toBe('stable')
    // 受保护目录本身不该作为安装出现在候选结果里。
    expect(installations.some(entry => entry.cliPath.includes(protectedSegment))).toBe(false)
    expect(await selectInstalledWechatDevtools(win32Options([programFiles]))).toMatchObject({ cliPath: stable.cliPath })
  })

  it('still reports unexpected scanner failures instead of swallowing every error', async () => {
    const { programFiles } = await createVendorLayout()
    await fs.mkdir(path.join(programFiles, brokenSegment), { recursive: true })

    await expect(listWechatDevtoolsInstallations(win32Options([programFiles]))).rejects.toMatchObject({ code: 'ERR_UNEXPECTED_SCANNER' })
  })
})
