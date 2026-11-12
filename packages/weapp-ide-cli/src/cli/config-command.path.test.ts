import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultCustomConfigFilePath } from '../config/paths'
import { handleConfigCommand } from './config-command'

const mocks = vi.hoisted(() => ({
  readConfig: vi.fn(),
  overwriteConfig: vi.fn(),
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@weapp-core/shared/fs', () => ({ fs: { readJSON: mocks.readJSON, writeJSON: mocks.writeJSON } }))
vi.mock('../config/custom', () => ({
  readCustomConfig: mocks.readConfig,
  overwriteCustomConfig: mocks.overwriteConfig,
  createAutoBootstrapDevtoolsConfig: vi.fn(),
  createAutoTrustProjectConfig: vi.fn(),
  createCustomConfig: vi.fn(),
  createLocaleConfig: vi.fn(),
  removeCustomConfigKey: vi.fn(),
}))
vi.mock('../config/resolver', () => ({ resolveDevtoolsAutomationDefaults: () => ({ autoBootstrapDevtools: true, autoTrustProject: false }) }))
vi.mock('../devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: vi.fn() }))
vi.mock('./resolver', () => ({ resolveCliPath: vi.fn() }))
vi.mock('./prompt', () => ({ promptForCliPath: vi.fn() }))
vi.mock('../logger', () => ({ default: { info: mocks.info }, colors: { green: (value: string) => value } }))

describe('configuration diagnostic paths', () => {
  let stderrIsTTY: PropertyDescriptor | undefined
  const cliPath = path.resolve('fixtures', '微信 tools #%?', 'cli')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CI', '')
    vi.stubEnv('TERM', 'xterm-256color')
    stderrIsTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })
    mocks.readConfig.mockResolvedValue({ cliPath })
    mocks.readJSON.mockResolvedValue({ cliPath })
  })

  afterEach(() => {
    if (stderrIsTTY) {
      Object.defineProperty(process.stderr, 'isTTY', stderrIsTTY)
    }
    else {
      Reflect.deleteProperty(process.stderr, 'isTTY')
    }
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('links the config file while keeping JSON path values unchanged', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleConfigCommand(['show'])
    expect(mocks.info).toHaveBeenCalledWith(`配置文件路径： ${pathToFileURL(defaultCustomConfigFilePath).href}`)
    expect(JSON.parse(output.mock.calls[0]![0] as string)).toMatchObject({ cliPath })
  })

  it('keeps config get as a raw path in a terminal', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleConfigCommand(['get', 'cliPath'])
    expect(output).toHaveBeenCalledExactlyOnceWith(cliPath)
    expect(mocks.info).not.toHaveBeenCalled()
  })

  it('links an exported relative file without changing its write location or data', async () => {
    const outputPath = path.join('exports', '微信 config #%?.json')
    await handleConfigCommand(['export', outputPath])
    expect(mocks.writeJSON).toHaveBeenCalledExactlyOnceWith(outputPath, { cliPath }, { spaces: 2, encoding: 'utf8' })
    expect(mocks.info).toHaveBeenCalledWith(`配置已导出到： ${pathToFileURL(path.resolve(outputPath)).href}`)
  })

  it('keeps JSON exports free of diagnostic formatting', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleConfigCommand(['export'])
    expect(JSON.parse(output.mock.calls[0]![0] as string)).toEqual({ cliPath })
    expect(mocks.info).not.toHaveBeenCalled()
  })

  it('links an imported file without changing the path saved to config', async () => {
    const inputPath = path.join('imports', '微信 config #%?.json')
    await handleConfigCommand(['import', inputPath])
    expect(mocks.readJSON).toHaveBeenCalledExactlyOnceWith(inputPath)
    expect(mocks.overwriteConfig).toHaveBeenCalledWith(expect.objectContaining({ cliPath }))
    expect(mocks.info).toHaveBeenCalledWith(`配置已从 ${pathToFileURL(path.resolve(inputPath)).href} 导入`)
  })
})
