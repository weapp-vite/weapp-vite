import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tryRunIdeCommand } from './ide'

const dispatchWechatCliCommandMock = vi.hoisted(() => vi.fn())
const isWeappIdeTopLevelCommandMock = vi.hoisted(() => vi.fn())
const executeWechatIdeCliCommandMock = vi.hoisted(() => vi.fn())
const warnMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  dispatchWechatCliCommand: dispatchWechatCliCommandMock,
  isWeappIdeTopLevelCommand: isWeappIdeTopLevelCommandMock,
}))

vi.mock('./openIde/execute', () => ({
  executeWechatIdeCliCommand: executeWechatIdeCliCommandMock,
}))

vi.mock('../logger', () => ({
  default: { warn: warnMock },
}))

describe('tryRunIdeCommand', () => {
  beforeEach(() => {
    dispatchWechatCliCommandMock.mockReset()
    isWeappIdeTopLevelCommandMock.mockReset()
    executeWechatIdeCliCommandMock.mockReset()
    warnMock.mockReset()
    dispatchWechatCliCommandMock.mockResolvedValue(false)
    executeWechatIdeCliCommandMock.mockResolvedValue(undefined)
    isWeappIdeTopLevelCommandMock.mockImplementation((command: string) =>
      ['cache', 'preview', 'upload', 'navigate', 'config', 'screenshot', 'compare'].includes(
        command,
      ),
    )
  })

  it('forwards cache command to weapp-ide-cli', async () => {
    const forwarded = await tryRunIdeCommand(['cache', '--clean', 'all'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith([
      'cache',
      '--clean',
      'all',
    ])
  })

  it('forwards automator command to weapp-ide-cli', async () => {
    const forwarded = await tryRunIdeCommand(['navigate', 'pages/index/index'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith([
      'navigate',
      'pages/index/index',
    ])
  })

  it('forwards compare command to weapp-ide-cli', async () => {
    const forwarded = await tryRunIdeCommand(['compare', '--baseline', 'baseline.png'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith(['compare', '--baseline', 'baseline.png'])
  })

  it('forwards help target for ide command', async () => {
    const forwarded = await tryRunIdeCommand(['help', 'navigate'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith(['help', 'navigate'])
  })

  it('keeps native help target untouched', async () => {
    const forwarded = await tryRunIdeCommand(['help', 'open'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('forwards namespaced ide command', async () => {
    const forwarded = await tryRunIdeCommand(['ide', 'config', 'lang', 'en'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith(['config', 'lang', 'en'])
  })

  it('prefers helper dispatch for namespaced ide command before execute fallback', async () => {
    dispatchWechatCliCommandMock.mockResolvedValueOnce(true)

    const forwarded = await tryRunIdeCommand(['ide', 'cache', '--clean', 'all'])

    expect(forwarded).toBe(true)
    expect(dispatchWechatCliCommandMock).toHaveBeenCalledWith(['cache', '--clean', 'all'])
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native ide logs command untouched', async () => {
    const forwarded = await tryRunIdeCommand(['ide', 'logs'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native ide doctor command untouched', async () => {
    const forwarded = await tryRunIdeCommand(['ide', 'doctor', '--json'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native ide help untouched', async () => {
    const forwarded = await tryRunIdeCommand(['ide', '--help'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native weapp-vite open command untouched', async () => {
    const forwarded = await tryRunIdeCommand(['open'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('does not forward weapp-vite build command', async () => {
    const forwarded = await tryRunIdeCommand(['build'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'short legacy flags', args: ['-p', './dist', '-v', '1.2.3', '-d', 'release'] },
    { name: 'long equals flags', args: ['--project=./dist', '--version=1.2.3', '--desc=release', '--info-output=info.json'] },
    { name: 'short equals flags', args: ['-p=./dist', '-v=1.2.3', '-d=release', '-i=info.json'] },
    { name: 'AppID locator', args: ['--appid', 'wx-example', '--ext-appid', 'wx-ext', '--version', '1.2.3', '--desc', 'release'] },
    { name: 'platform-named project path', args: ['-p', 'jd', '-v', '1.2.3', '-d', 'release'] },
    { name: 'SDK-looking metadata value', args: ['--project=--platform', '--version=1.2.3', '--desc=--bump'] },
    // readOptionValue 将独立的下一个 token 作为值；以 - 开头也不能改判成 SDK 选项。
    { name: 'separate SDK-looking description', args: ['-p', './dist', '-v', '1.2.3', '-d', '--bump'] },
    { name: 'separate SDK-looking version', args: ['--project', './dist', '--version', '--bump', 'patch', '--desc', 'release'] },
    { name: 'terminator-valued description', args: ['--desc', '--', '--project', './dist', '--version', '1.2.3'] },
    { name: 'terminator before SDK flags', args: ['-p', './dist', '-v', '1.2.3', '-d', 'release', '--', '--bump', 'patch'] },
  ])('selects IDE upload with one migration notice for $name', async ({ args }) => {
    dispatchWechatCliCommandMock.mockResolvedValueOnce(true)

    expect(await tryRunIdeCommand(['upload', ...args])).toBe(true)
    expect(dispatchWechatCliCommandMock).toHaveBeenCalledTimes(1)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalledTimes(1)
  })

  it('uses the existing IDE fallback when the helper declines', async () => {
    const argv = ['upload', '-p=./dist', '-v=1.2.3', '-d=release with spaces']

    expect(await tryRunIdeCommand(argv)).toBe(true)
    expect(dispatchWechatCliCommandMock).toHaveBeenCalledTimes(1)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledTimes(1)
    expect(warnMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'default SDK upload', args: [] },
    { name: 'single SDK platform', args: ['-p', 'weapp', '--uv', '1.2.3'] },
    { name: 'batch SDK platforms', args: ['--platform=jd,tt', '--desc=release'] },
    { name: 'SDK auto metadata', args: ['-p', 'all', '--bump', 'minor', '--git-desc', '--dry-run'] },
    { name: 'SDK result and timeout', args: ['--json', '--timeout', '30'] },
    { name: 'legacy-looking timeout value', args: ['--timeout', '--project'] },
    { name: 'ambiguous short project flag', args: ['-p', './dist'] },
    { name: 'native debug alias', args: ['-d', 'upload'] },
    { name: 'legacy-looking metadata values', args: ['--uv=--project', '--desc=--version'] },
    { name: 'separate legacy-looking metadata values', args: ['--uv', '--project', '--desc', '--version'] },
    { name: 'legacy-looking config value', args: ['--config', '--project'] },
    { name: 'shared description without dialect markers', args: ['--desc=--project'] },
    { name: 'terminator before legacy flags', args: ['--', '--project', './dist', '-v', '1.2.3'] },
    { name: 'SDK help', args: ['--help'] },
  ])('keeps $name native without a migration notice', async ({ args }) => {
    expect(await tryRunIdeCommand(['upload', ...args])).toBe(false)
    expect(dispatchWechatCliCommandMock).not.toHaveBeenCalled()
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
    expect(warnMock).not.toHaveBeenCalled()
  })

  it.each([
    '--platform=weapp',
    '--uv=1.2.3',
    '--bump=patch',
    '--git-desc',
    '--dry-run=false',
    '--json',
    '--timeout=30',
    '--no-json',
    '--no-timeout',
    '--no-platform',
    '--no-uv',
    '--no-bump',
    '--no-git-desc',
    '--no-dry-run',
  ])('rejects legacy upload mixed with %s before either execution branch', async (flag) => {
    await expect(tryRunIdeCommand(['upload', '-p', './dist', '-v', '1.2.3', '-d', 'release', flag])).rejects.toThrow()
    expect(dispatchWechatCliCommandMock).not.toHaveBeenCalled()
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
    expect(warnMock).not.toHaveBeenCalled()
  })

  it.each([
    ['--project=', '--bump', 'patch'],
    ['--version=', '--git-desc'],
    ['--uv=', '--appid=wx-example'],
    ['--info-output=info.json', '--dry-run'],
    ['--ext-appid=wx-ext', '--platform=weapp'],
    ['-i=info.json', '--no-bump'],
    ['--project', './dist', '--version', '1.2.3', '--desc', 'release', '--debug', '--bump', 'patch'],
  ])('rejects incomplete mixed upload arguments %j without falling back', async (...args) => {
    await expect(tryRunIdeCommand(['upload', ...args])).rejects.toThrow()
    expect(dispatchWechatCliCommandMock).not.toHaveBeenCalled()
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
    expect(warnMock).not.toHaveBeenCalled()
  })

  it('restores legacy upload help with one migration notice', async () => {
    expect(await tryRunIdeCommand(['help', 'upload'])).toBe(true)
    expect(dispatchWechatCliCommandMock).not.toHaveBeenCalled()
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledTimes(1)
    expect(warnMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['upload', '--project', './dist', '-v', '1.2.3', '-d', 'release'],
    ['upload', '--project', './dist', '--bump', 'patch'],
    ['help', 'upload'],
    ['preview', '--project', './dist'],
  ])('preserves explicit IDE %j without compatibility checks or warnings', async (...args) => {
    expect(await tryRunIdeCommand(['ide', ...args])).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledTimes(1)
    expect(warnMock).not.toHaveBeenCalled()
  })

  it.each([
    ['preview', '--project', './dist'],
    ['preview', '--platform', 'jd'],
    ['help', 'preview'],
  ])('does not expand compatibility to %j', async (...args) => {
    expect(await tryRunIdeCommand(args)).toBe(false)
    expect(dispatchWechatCliCommandMock).not.toHaveBeenCalled()
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
    expect(warnMock).not.toHaveBeenCalled()
  })

  it('does not forward weapp-vite mcp command', async () => {
    const forwarded = await tryRunIdeCommand(['mcp'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('forwards unknown command to weapp-ide-cli', async () => {
    const forwarded = await tryRunIdeCommand(['foobar', '--x'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })
})
