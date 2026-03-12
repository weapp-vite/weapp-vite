import type { RolldownOutput } from 'rolldown'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PACKAGE_SIZE_WARNING_BYTES, logBuildPackageSizeReport } from './logBuildPackageSizeReport'

const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const colorsMock = vi.hoisted(() => ({
  yellow: vi.fn((value: string) => value),
}))

vi.mock('../logger', () => ({
  default: {
    info: loggerInfoMock,
    success: loggerSuccessMock,
    warn: loggerWarnMock,
  },
  colors: colorsMock,
}))

describe('logBuildPackageSizeReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs main package and subpackage size summary in a stable order', () => {
    const output: RolldownOutput = {
      output: [
        {
          type: 'chunk',
          fileName: 'common.js',
          code: 'main',
        },
        {
          type: 'asset',
          fileName: 'pkg-a/pages/a/index.json',
          source: '{}',
        },
        {
          type: 'asset',
          fileName: 'pkg-b/pages/b/index.json',
          source: Uint8Array.from([1, 2, 3]),
        },
        {
          type: 'chunk',
          fileName: 'pkg-b/pages/b/index.js',
          code: 'sub-b',
        },
      ],
    } as RolldownOutput

    logBuildPackageSizeReport({
      output,
      subPackageMap: new Map([
        ['pkg-b', { subPackage: { root: 'pkg-b', independent: true } } as any],
        ['pkg-a', { subPackage: { root: 'pkg-a', independent: false } } as any],
      ]),
      warningBytes: 0,
    })

    expect(loggerSuccessMock).toHaveBeenCalledWith('主包/分包体积报告：')
    expect(loggerInfoMock.mock.calls).toEqual([
      ['主包：4 B'],
      ['分包 pkg-a：2 B'],
      ['独立分包 pkg-b：8 B'],
    ])
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('warns when package size exceeds the configured threshold', () => {
    const output: RolldownOutput = {
      output: [
        {
          type: 'chunk',
          fileName: 'app.js',
          code: '123456',
        },
      ],
    } as RolldownOutput

    logBuildPackageSizeReport({
      output,
      warningBytes: 5,
    })

    expect(loggerWarnMock).toHaveBeenCalledWith('[包体积] 主包 体积 6 B，已超过阈值 5 B。')
    expect(colorsMock.yellow).toHaveBeenCalled()
  })

  it('uses the default 2 MB warning threshold', () => {
    const output: RolldownOutput = {
      output: [
        {
          type: 'chunk',
          fileName: 'app.js',
          code: '1234',
        },
      ],
    } as RolldownOutput

    logBuildPackageSizeReport({
      output,
    })

    expect(loggerWarnMock).not.toHaveBeenCalled()
    expect(DEFAULT_PACKAGE_SIZE_WARNING_BYTES).toBe(2 * 1024 * 1024)
  })
})
