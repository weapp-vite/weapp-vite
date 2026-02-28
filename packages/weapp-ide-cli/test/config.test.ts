import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fsMock = vi.hoisted(() => {
  const ensureDir = vi.fn()
  const writeJSON = vi.fn()
  const pathExists = vi.fn()
  const readJSON = vi.fn()
  return { ensureDir, writeJSON, pathExists, readJSON }
})

const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

const colorsMock = vi.hoisted(() => ({
  green: vi.fn((value: string) => value),
}))

const platformMock = vi.hoisted(() => ({
  getDefaultCliPath: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: fsMock.ensureDir,
    writeJSON: fsMock.writeJSON,
    pathExists: fsMock.pathExists,
    readJSON: fsMock.readJSON,
  },
  ensureDir: fsMock.ensureDir,
  writeJSON: fsMock.writeJSON,
  pathExists: fsMock.pathExists,
  readJSON: fsMock.readJSON,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
  colors: colorsMock,
}))

vi.mock('../src/runtime/platform', () => ({
  getDefaultCliPath: platformMock.getDefaultCliPath,
}))

async function loadConfigModule() {
  return import('../src/config')
}

describe('config helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    fsMock.ensureDir.mockReset()
    fsMock.writeJSON.mockReset()
    fsMock.pathExists.mockReset()
    fsMock.readJSON.mockReset()
    loggerMock.log.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    colorsMock.green.mockClear()
    platformMock.getDefaultCliPath.mockReset()
    platformMock.getDefaultCliPath.mockResolvedValue('/default/cli')
  })

  it('normalises and writes custom config', async () => {
    fsMock.ensureDir.mockResolvedValue(undefined)
    fsMock.writeJSON.mockResolvedValue(undefined)

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace/app')

    const { createCustomConfig } = await loadConfigModule()
    const result = await createCustomConfig({ cliPath: './cli/bin' })

    expect(result).toBe('/workspace/app/cli/bin')
    expect(fsMock.ensureDir).toHaveBeenCalledTimes(1)
    expect(fsMock.writeJSON).toHaveBeenCalledTimes(1)

    const [[configDir]] = fsMock.ensureDir.mock.calls
    const [[configFile, payload, options]] = fsMock.writeJSON.mock.calls

    expect(path.isAbsolute(configFile)).toBe(true)
    expect(configFile.startsWith(configDir)).toBe(true)
    expect(payload).toEqual({ cliPath: '/workspace/app/cli/bin' })
    expect(options).toEqual({ encoding: 'utf8', spaces: 2 })

    cwdSpy.mockRestore()
  })

  it('returns custom config when file exists with valid path', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockResolvedValue({ cliPath: '/custom/cli', locale: 'en' })

    const { getConfig } = await loadConfigModule()
    const result = await getConfig()

    expect(result).toEqual({ cliPath: '/custom/cli', locale: 'en', source: 'custom' })
    expect(loggerMock.info).toHaveBeenCalledWith('自定义 CLI 路径：/custom/cli')
  })

  it('falls back to default config when custom file missing', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    const { getConfig } = await loadConfigModule()
    const result = await getConfig()

    expect(result.source).toBe('default')
    expect(typeof result.cliPath).toBe('string')
    expect(result.cliPath.length).toBeGreaterThan(0)
  })

  it('falls back to default config when custom path invalid', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockResolvedValue({ cliPath: '   ' })

    const { getConfig } = await loadConfigModule()
    const result = await getConfig()

    expect(result.source).toBe('default')
    expect(loggerMock.warn).toHaveBeenCalled()
  })

  it('writes locale config and preserves existing cliPath', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockResolvedValue({ cliPath: '/custom/cli', locale: 'zh' })
    fsMock.ensureDir.mockResolvedValue(undefined)
    fsMock.writeJSON.mockResolvedValue(undefined)

    const { createLocaleConfig } = await loadConfigModule()
    const result = await createLocaleConfig('en')

    expect(result).toBe('en')
    expect(fsMock.writeJSON).toHaveBeenCalledTimes(1)
    const [, payload] = fsMock.writeJSON.mock.calls[0]
    expect(payload).toEqual({
      cliPath: '/custom/cli',
      locale: 'en',
    })
  })

  it('removes config key via removeCustomConfigKey', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockResolvedValue({ cliPath: '/custom/cli', locale: 'en' })
    fsMock.ensureDir.mockResolvedValue(undefined)
    fsMock.writeJSON.mockResolvedValue(undefined)

    const { removeCustomConfigKey } = await loadConfigModule()
    await removeCustomConfigKey('locale')

    const [, payload] = fsMock.writeJSON.mock.calls[0]
    expect(payload).toEqual({
      cliPath: '/custom/cli',
    })
  })

  it('overwrites config content via overwriteCustomConfig', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockResolvedValue({ cliPath: '/old/cli', locale: 'zh' })
    fsMock.ensureDir.mockResolvedValue(undefined)
    fsMock.writeJSON.mockResolvedValue(undefined)
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace/app')

    const { overwriteCustomConfig } = await loadConfigModule()
    await overwriteCustomConfig({
      cliPath: './new/cli',
      locale: 'en',
    })

    const [, payload] = fsMock.writeJSON.mock.calls[0]
    expect(payload).toEqual({
      cliPath: '/workspace/app/new/cli',
      locale: 'en',
    })
    cwdSpy.mockRestore()
  })
})
