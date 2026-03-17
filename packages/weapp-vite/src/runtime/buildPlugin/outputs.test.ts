import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanOutputs, syncExternalPluginOutputs } from './outputs'

const rimrafMock = vi.hoisted(() => vi.fn(async () => []))
const debugMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  success: vi.fn(),
}))
const getAlipayNpmDistDirNameMock = vi.hoisted(() => vi.fn(() => 'miniprogram_npm_alipay'))
const statMock = vi.hoisted(() => vi.fn(async () => {
  throw new Error('ENOENT')
}))
const mkdirMock = vi.hoisted(() => vi.fn(async () => undefined))
const cpMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('node:fs/promises', () => {
  return {
    stat: statMock,
    mkdir: mkdirMock,
    cp: cpMock,
  }
})

vi.mock('rimraf', () => {
  return {
    rimraf: rimrafMock,
  }
})

vi.mock('../../context/shared', () => {
  return {
    debug: debugMock,
    logger: loggerMock,
  }
})

vi.mock('../../utils/alipayNpm', () => {
  return {
    getAlipayNpmDistDirName: getAlipayNpmDistDirNameMock,
  }
})

function createConfigService(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'wechat',
    weappViteConfig: {},
    outDir: '/project/dist',
    mpDistRoot: '/project/dist',
    absolutePluginOutputRoot: undefined,
    relativeCwd: (value: string) => value.replace('/project/', ''),
    ...overrides,
  } as any
}

describe('buildPlugin outputs', () => {
  beforeEach(() => {
    rimrafMock.mockReset()
    rimrafMock.mockResolvedValue([])
    debugMock.mockReset()
    loggerMock.success.mockReset()
    getAlipayNpmDistDirNameMock.mockReset()
    getAlipayNpmDistDirNameMock.mockReturnValue('miniprogram_npm_alipay')
    statMock.mockReset()
    statMock.mockImplementation(async () => {
      throw new Error('ENOENT')
    })
    mkdirMock.mockReset()
    cpMock.mockReset()
  })

  it('cleans mp output and keeps miniprogram_npm for wechat', async () => {
    const configService = createConfigService()

    await cleanOutputs(configService)

    expect(rimrafMock).toHaveBeenCalledTimes(1)
    const filter = rimrafMock.mock.calls[0]?.[1]?.filter as ((filePath: string) => boolean)
    expect(filter('/project/dist/miniprogram_npm/pkg/index.js')).toBe(false)
    expect(filter('/project/dist/pages/index/index.js')).toBe(true)
    expect(loggerMock.success).toHaveBeenCalledWith('已清空 /project/dist 目录')
  })

  it('uses alipay npm dist dir name when platform is alipay', async () => {
    const configService = createConfigService({
      platform: 'alipay',
      weappViteConfig: {
        npm: {
          alipayNpmMode: 'plugin',
        },
      },
    })

    await cleanOutputs(configService)

    expect(getAlipayNpmDistDirNameMock).toHaveBeenCalledWith('plugin')
    const filter = rimrafMock.mock.calls[0]?.[1]?.filter as ((filePath: string) => boolean)
    expect(filter('/project/dist/miniprogram_npm_alipay/pkg/index.js')).toBe(false)
    expect(filter('/project/dist/miniprogram_npm/pkg/index.js')).toBe(true)
  })

  it('cleans plugin output only when plugin output root is outside outDir', async () => {
    const outsideConfig = createConfigService({
      absolutePluginOutputRoot: '/project/plugin-dist',
    })

    await cleanOutputs(outsideConfig)
    expect(rimrafMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.success).toHaveBeenCalledWith('已清空 plugin-dist 目录')

    rimrafMock.mockReset()
    loggerMock.success.mockReset()

    const insideConfig = createConfigService({
      absolutePluginOutputRoot: '/project/dist/plugin',
    })
    await cleanOutputs(insideConfig)

    expect(rimrafMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.success).toHaveBeenCalledTimes(1)
  })

  it('skips all cleanup when both mpDistRoot and pluginOutputRoot are disabled', async () => {
    const configService = createConfigService({
      mpDistRoot: '',
      absolutePluginOutputRoot: undefined,
    })

    await cleanOutputs(configService)
    expect(rimrafMock).not.toHaveBeenCalled()
    expect(loggerMock.success).not.toHaveBeenCalled()
  })

  it('syncs plugin outputs when plugin output root is outside outDir', async () => {
    const configService = createConfigService({
      absolutePluginRoot: '/project/plugin',
      absolutePluginOutputRoot: '/project/dist-plugin',
    })
    statMock.mockResolvedValue({} as any)

    await syncExternalPluginOutputs(configService)

    expect(mkdirMock).toHaveBeenCalledWith('/project/dist-plugin', { recursive: true })
    expect(cpMock).toHaveBeenCalledWith('/project/dist/plugin', '/project/dist-plugin', {
      recursive: true,
      force: true,
    })
    expect(loggerMock.success).toHaveBeenCalledWith('已同步插件产物到 dist-plugin 目录')
  })

  it('does not sync plugin outputs when plugin output root stays inside outDir', async () => {
    const configService = createConfigService({
      absolutePluginRoot: '/project/plugin',
      absolutePluginOutputRoot: '/project/dist/plugin',
    })
    statMock.mockResolvedValue({} as any)

    await syncExternalPluginOutputs(configService)

    expect(mkdirMock).not.toHaveBeenCalled()
    expect(cpMock).not.toHaveBeenCalled()
  })
})
