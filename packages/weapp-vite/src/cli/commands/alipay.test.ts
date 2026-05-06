import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMinidevMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
}))

vi.mock('./alipayExecute', () => ({
  spawnMinidev: spawnMinidevMock,
}))

vi.mock('../openIde', () => ({
  resolveIdeCommandContext: resolveIdeCommandContextMock,
}))

vi.mock('../options', () => ({
  filterDuplicateOptions: filterDuplicateOptionsMock,
  resolveConfigFile: resolveConfigFileMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

describe('alipay minidev command', () => {
  beforeEach(() => {
    spawnMinidevMock.mockReset()
    resolveIdeCommandContextMock.mockReset()
    filterDuplicateOptionsMock.mockReset()
    resolveConfigFileMock.mockReset()
    loggerMock.info.mockReset()

    spawnMinidevMock.mockResolvedValue(undefined)
    resolveIdeCommandContextMock.mockResolvedValue({
      platform: 'alipay',
      projectPath: '/workspace/demo/dist/alipay',
    })
  })

  it('creates preview argv with resolved project and app id', async () => {
    const { createMinidevArgv } = await import('./alipay')

    expect(createMinidevArgv('preview', undefined, '/workspace/demo/dist/alipay', {
      appId: '2021000000000000',
    })).toEqual([
      'preview',
      '--project',
      '/workspace/demo/dist/alipay',
      '--app-id',
      '2021000000000000',
    ])
  })

  it('keeps passthrough options and does not duplicate explicit project or app id', async () => {
    const { createMinidevArgv } = await import('./alipay')

    expect(createMinidevArgv('upload', undefined, '/workspace/demo/dist/alipay', {
      '--': ['--project', '/custom/project', '-a', '2021000000000001', '--experience'],
      'appId': 'ignored',
      'version': '1.0.1',
    })).toEqual([
      'upload',
      '--version',
      '1.0.1',
      '--project',
      '/custom/project',
      '-a',
      '2021000000000001',
      '--experience',
    ])
  })

  it('does not append project to login command', async () => {
    const { createMinidevArgv } = await import('./alipay')

    expect(createMinidevArgv('login', '/workspace/demo', '/workspace/demo/dist/alipay', {})).toEqual(['login'])
  })

  it('creates ide argv with resolved project path', async () => {
    const { createMinidevArgv } = await import('./alipay')

    expect(createMinidevArgv('ide', undefined, '/workspace/demo/dist/alipay', {})).toEqual([
      'ide',
      '--project',
      '/workspace/demo/dist/alipay',
    ])
  })

  it('does not duplicate explicit short client type option', async () => {
    const { createMinidevArgv } = await import('./alipay')

    expect(createMinidevArgv('preview', undefined, '/workspace/demo/dist/alipay', {
      '--': ['-c', 'com.alipay.alipaywallet'],
      'clientType': 'ignored',
    })).toEqual([
      'preview',
      '--project',
      '/workspace/demo/dist/alipay',
      '-c',
      'com.alipay.alipaywallet',
    ])
  })

  it('runs minidev with resolved alipay project root', async () => {
    const { runAlipayCommand } = await import('./alipay')

    await runAlipayCommand('preview', undefined, {
      '--': ['--page', 'pages/index/index'],
      'appId': '2021000000000000',
      'minidev': 'custom-minidev',
    })

    expect(resolveIdeCommandContextMock).toHaveBeenCalledWith({
      configFile: undefined,
      mode: 'development',
      platform: 'alipay',
      projectPath: undefined,
      cliPlatform: 'alipay',
    })
    expect(spawnMinidevMock).toHaveBeenCalledWith('custom-minidev', [
      'preview',
      '--project',
      '/workspace/demo/dist/alipay',
      '--app-id',
      '2021000000000000',
      '--page',
      'pages/index/index',
    ])
  })

  it('maps open alias to minidev ide', async () => {
    const { runAlipayCommand } = await import('./alipay')

    await runAlipayCommand('open', '/workspace/demo/dist/alipay', {})

    expect(spawnMinidevMock).toHaveBeenCalledWith('minidev', [
      'ide',
      '--project',
      '/workspace/demo/dist/alipay',
    ])
  })

  it('rejects failed minidev process', async () => {
    spawnMinidevMock.mockRejectedValueOnce(new Error('minidev upload exited with code 1'))
    const { runAlipayCommand } = await import('./alipay')

    await expect(runAlipayCommand('upload', '/workspace/demo/dist/alipay', {
      appId: '2021000000000000',
    })).rejects.toThrow('minidev upload exited with code 1')
  })
})
