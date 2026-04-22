import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanOutputs, isOutputRootInsideOutDir, resetEmittedOutputCaches, syncExternalPluginOutputs } from './outputs'

const DEFAULT_TEST_PLATFORM = 'weapp'

const debugMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  success: vi.fn(),
}))
const statMock = vi.hoisted(() => vi.fn(async () => {
  throw new Error('ENOENT')
}))
const mkdirMock = vi.hoisted(() => vi.fn(async () => undefined))
const readdirMock = vi.hoisted(() => vi.fn(async () => []))
const rmMock = vi.hoisted(() => vi.fn(async () => undefined))
const cpMock = vi.hoisted(() => vi.fn(async () => undefined))
const getPreservedNpmDirNamesMock = vi.hoisted(() => vi.fn(() => ['miniprogram_npm']))

vi.mock('node:fs/promises', () => {
  return {
    stat: statMock,
    mkdir: mkdirMock,
    readdir: readdirMock,
    rm: rmMock,
    cp: cpMock,
  }
})

vi.mock('../../context/shared', () => {
  return {
    debug: debugMock,
    logger: loggerMock,
  }
})

vi.mock('../../platform', () => {
  return {
    getPreservedNpmDirNames: getPreservedNpmDirNamesMock,
  }
})

function createConfigService(overrides: Record<string, unknown> = {}) {
  return {
    platform: DEFAULT_TEST_PLATFORM,
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
    debugMock.mockReset()
    loggerMock.success.mockReset()
    getPreservedNpmDirNamesMock.mockReset()
    getPreservedNpmDirNamesMock.mockReturnValue(['miniprogram_npm'])
    statMock.mockReset()
    statMock.mockImplementation(async () => {
      throw new Error('ENOENT')
    })
    mkdirMock.mockReset()
    readdirMock.mockReset()
    readdirMock.mockResolvedValue([])
    rmMock.mockReset()
    cpMock.mockReset()
  })

  it('detects whether plugin outputs stay inside the main outDir', () => {
    expect(isOutputRootInsideOutDir('/project/dist', '/project/dist')).toBe(true)
    expect(isOutputRootInsideOutDir('/project/dist', '/project/dist/plugin')).toBe(true)
    expect(isOutputRootInsideOutDir('/project/dist', '/project/dist-plugin')).toBe(false)
  })

  it('cleans mp output and keeps miniprogram_npm for default mini-program platform', async () => {
    const configService = createConfigService()
    readdirMock.mockResolvedValue([
      { name: 'pages' },
      { name: 'miniprogram_npm' },
      { name: '.tea' },
    ])

    await cleanOutputs(configService)

    expect(rmMock).toHaveBeenCalledTimes(2)
    expect(rmMock).toHaveBeenCalledWith('/project/dist/pages', {
      recursive: true,
      force: true,
    })
    expect(rmMock).toHaveBeenCalledWith('/project/dist/.tea', {
      recursive: true,
      force: true,
    })
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
    readdirMock.mockResolvedValue([
      { name: 'miniprogram_npm_alipay' },
      { name: 'miniprogram_npm' },
    ])
    getPreservedNpmDirNamesMock.mockReturnValue(['miniprogram_npm_alipay'])

    await cleanOutputs(configService)

    expect(getPreservedNpmDirNamesMock).toHaveBeenCalledWith('alipay', {
      alipayNpmMode: 'plugin',
    })
    expect(rmMock).toHaveBeenCalledTimes(1)
    expect(rmMock).toHaveBeenCalledWith('/project/dist/miniprogram_npm', {
      recursive: true,
      force: true,
    })
  })

  it('cleans plugin output only when plugin output root is outside outDir', async () => {
    const outsideConfig = createConfigService({
      absolutePluginOutputRoot: '/project/plugin-dist',
    })
    readdirMock.mockResolvedValue([
      { name: 'index.js' },
    ])

    await cleanOutputs(outsideConfig)
    expect(rmMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.success).toHaveBeenCalledWith('已清空 plugin-dist 目录')

    rmMock.mockReset()
    loggerMock.success.mockReset()
    readdirMock.mockResolvedValue([])

    const insideConfig = createConfigService({
      absolutePluginOutputRoot: '/project/dist/plugin',
    })
    await cleanOutputs(insideConfig)

    expect(rmMock).not.toHaveBeenCalled()
    expect(loggerMock.success).toHaveBeenCalledTimes(1)
  })

  it('skips all cleanup when both mpDistRoot and pluginOutputRoot are disabled', async () => {
    const configService = createConfigService({
      mpDistRoot: '',
      absolutePluginOutputRoot: undefined,
    })

    await cleanOutputs(configService)
    expect(rmMock).not.toHaveBeenCalled()
    expect(loggerMock.success).not.toHaveBeenCalled()
  })

  it('clears emitted output caches after output cleanup', () => {
    const runtimeState = {
      json: {
        emittedSource: new Map([['app.json', '{}']]),
      },
      asset: {
        emittedBuffer: new Map([['images/logo.png', Buffer.from('logo')]]),
      },
      css: {
        emittedSource: new Map([['app.wxss', '.page {}']]),
      },
      wxml: {
        emittedCode: new Map([['pages/index/index.wxml', '<view />']]),
      },
    } as any

    resetEmittedOutputCaches(runtimeState)

    expect(runtimeState.json.emittedSource.size).toBe(0)
    expect(runtimeState.asset.emittedBuffer.size).toBe(0)
    expect(runtimeState.css.emittedSource.size).toBe(0)
    expect(runtimeState.wxml.emittedCode.size).toBe(0)
  })

  it('syncs plugin outputs when plugin output root is outside outDir', async () => {
    const configService = createConfigService({
      absolutePluginRoot: '/project/plugin',
      absolutePluginOutputRoot: '/project/dist-plugin',
    })
    statMock.mockResolvedValue({} as any)
    readdirMock.mockResolvedValue(['index.js', 'pages'])

    await syncExternalPluginOutputs(configService)

    expect(mkdirMock).toHaveBeenCalledWith('/project/dist-plugin', { recursive: true })
    expect(cpMock).toHaveBeenCalledWith('/project/dist-plugin/plugin/index.js', '/project/dist-plugin/index.js', {
      recursive: true,
      force: true,
    })
    expect(cpMock).toHaveBeenCalledWith('/project/dist-plugin/plugin/pages', '/project/dist-plugin/pages', {
      recursive: true,
      force: true,
    })
    expect(rmMock).toHaveBeenCalledWith('/project/dist-plugin/plugin', {
      recursive: true,
      force: true,
    })
    expect(loggerMock.success).toHaveBeenCalledWith('已整理插件产物到 dist-plugin 目录')
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

  it('returns early when sync plugin roots are missing', async () => {
    await syncExternalPluginOutputs(createConfigService({
      absolutePluginRoot: undefined,
      absolutePluginOutputRoot: '/project/dist-plugin',
    }))

    expect(statMock).not.toHaveBeenCalled()
    expect(mkdirMock).not.toHaveBeenCalled()
  })

  it('rethrows non-ENOENT cleanup errors from output root scan', async () => {
    const configService = createConfigService()
    const error = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    readdirMock.mockRejectedValueOnce(error)

    await expect(cleanOutputs(configService)).rejects.toThrow('permission denied')
  })

  it('treats missing output root as empty directory during cleanup', async () => {
    const configService = createConfigService()
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' })
    readdirMock.mockRejectedValueOnce(error)

    await cleanOutputs(configService)

    expect(loggerMock.success).toHaveBeenCalledWith('已清空 /project/dist 目录')
    expect(rmMock).not.toHaveBeenCalled()
  })

  it('returns quietly when plugin bundle root does not exist yet', async () => {
    const configService = createConfigService({
      absolutePluginRoot: '/project/plugin',
      absolutePluginOutputRoot: '/project/dist-plugin',
    })

    await syncExternalPluginOutputs(configService)

    expect(mkdirMock).not.toHaveBeenCalled()
    expect(cpMock).not.toHaveBeenCalled()
    expect(loggerMock.success).not.toHaveBeenCalled()
  })
})
