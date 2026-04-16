import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pathExistsMock = vi.hoisted(() => vi.fn(async (_candidate: string) => false))
const accessMock = vi.hoisted(() => vi.fn(async (_candidate: string, _mode?: number) => undefined))
const loggerWarnMock = vi.hoisted(() => vi.fn())

function normalizeSlashes(value: string) {
  return value.replace(/\\/g, '/').toLowerCase()
}

vi.mock('@weapp-core/shared', () => ({
  fs: {
    access: accessMock,
    pathExists: pathExistsMock,
    constants: {
      X_OK: 1,
    },
  },
}))

vi.mock('../src/logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

describe('runtime/platform', () => {
  beforeEach(() => {
    vi.resetModules()
    pathExistsMock.mockReset()
    accessMock.mockReset()
    loggerWarnMock.mockReset()
    process.env['ProgramFiles(x86)'] = 'D:\\Program Files (x86)'
    process.env.ProgramFiles = 'D:\\Program Files'
    process.env.LOCALAPPDATA = 'D:\\Users\\tester\\AppData\\Local'
  })

  it('resolves the first available Windows cli candidate', async () => {
    const expectedPath = path.join(process.env['ProgramFiles(x86)']!, 'Tencent', '微信web开发者工具', 'cli.bat')
    pathExistsMock.mockImplementation(async (candidate: string) => normalizeSlashes(candidate) === normalizeSlashes(expectedPath))

    const { getDefaultCliPath, SupportedPlatformsMap } = await import('../src/runtime/platform')
    const result = await getDefaultCliPath(SupportedPlatformsMap.Windows_NT)

    expect(normalizeSlashes(result!)).toBe(normalizeSlashes(expectedPath))
  })

  it('falls back to a per-user Windows install path when Program Files is missing', async () => {
    const expectedPath = path.join(process.env.LOCALAPPDATA!, 'Programs', '微信开发者工具', 'cli.bat')
    pathExistsMock.mockImplementation(async (candidate: string) => normalizeSlashes(candidate) === normalizeSlashes(expectedPath))

    const { getDefaultCliPath, SupportedPlatformsMap } = await import('../src/runtime/platform')
    const result = await getDefaultCliPath(SupportedPlatformsMap.Windows_NT)

    expect(normalizeSlashes(result!)).toBe(normalizeSlashes(expectedPath))
  })
})
