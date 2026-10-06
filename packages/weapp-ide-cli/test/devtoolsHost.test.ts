import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertWechatDevtoolsHost, assertWechatDevtoolsPort } from '../src/devtoolsTarget/host'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
let root: string
function target() {
  return { cliPath: path.join(root, 'selected.app', 'Contents', 'MacOS', 'cli'), appPath: path.join(root, 'selected.app', 'Contents', 'Resources', 'app.asar'), installationId: 'selected', profileDir: path.join(root, 'data', 'selected') }
}
function executable(installation = 'selected.app') {
  return path.join(root, installation, 'Contents', 'MacOS', 'Electron')
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-host-'))
  execute.mockReset()
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})

describe('DevTools host ownership', () => {
  it('permits startup with no singleton owner and does not inspect unrelated processes', async () => {
    await assertWechatDevtoolsHost(target(), { platform: 'darwin' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects another installation that owns the shared singleton even at the same product version', async () => {
    const sharedLock = path.join(root, 'data', 'SingletonLock')
    const readLink = vi.spyOn(fs, 'readlink').mockImplementation(async (file) => {
      if (file === sharedLock) {
        return `test-host-${process.pid}`
      }
      throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    })
    execute.mockResolvedValue({ exitCode: 0, stdout: executable('other.app') })
    await expect(assertWechatDevtoolsHost(target(), { platform: 'darwin' })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
    execute.mockResolvedValue({ exitCode: 0, stdout: executable() })
    await assertWechatDevtoolsHost(target(), { platform: 'darwin' })
    execute.mockResolvedValue({ exitCode: 1, stdout: '' })
    await assertWechatDevtoolsHost(target(), { platform: 'darwin' })
    expect(readLink).toHaveBeenCalledWith(sharedLock)
  })

  it('checks TCP listener executable ownership before allowing an explicit port', async () => {
    execute.mockResolvedValueOnce({ exitCode: 0, stdout: `p${process.pid}\n` }).mockResolvedValueOnce({ exitCode: 0, stdout: executable('other.app') })
    await expect(assertWechatDevtoolsPort(target(), 22001, { platform: 'darwin' })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
    execute.mockResolvedValueOnce({ exitCode: 0, stdout: `p${process.pid}\n` }).mockResolvedValueOnce({ exitCode: 0, stdout: executable() })
    await assertWechatDevtoolsPort(target(), 22001, { platform: 'darwin' })
    expect(execute).toHaveBeenCalledWith('lsof', ['-nP', '-iTCP:22001', '-sTCP:LISTEN', '-Fp'], expect.objectContaining({ reject: false, timeout: 3_000 }))
  })

  it('rejects missing listeners and unavailable inspection instead of trusting the port number', async () => {
    execute.mockResolvedValueOnce({ exitCode: 1, stdout: '' })
    await expect(assertWechatDevtoolsPort(target(), 22001, { platform: 'darwin' })).rejects.toThrow('No verified')
    execute.mockRejectedValueOnce(new Error('inspection unavailable'))
    await expect(assertWechatDevtoolsPort(target(), 22001, { platform: 'darwin' })).rejects.toThrow('Unable to verify')
  })

  it('uses Windows listener PIDs and executable paths with case-insensitive comparison', async () => {
    const selected = { ...target(), cliPath: 'C:\\Tools\\WeChat\\cli.bat', appPath: 'C:\\Tools\\WeChat\\resources\\app.asar' }
    execute.mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify([{ ProcessId: 123, ExecutablePath: 'c:\\tools\\wechat\\wechatdevtools.exe' }]) })
    await assertWechatDevtoolsPort(selected, 22001, { platform: 'win32' })
    execute.mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify([{ ProcessId: 124, ExecutablePath: 'C:\\Other\\wechatdevtools.exe' }]) })
    await expect(assertWechatDevtoolsHost(selected, { platform: 'win32' })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
  })

  it('bounds Windows cold inspection while respecting smaller caller budgets and cancellation', async () => {
    const signal = new AbortController().signal
    execute.mockResolvedValue({ exitCode: 0, stdout: '[]' })
    await assertWechatDevtoolsHost(target(), { platform: 'win32', signal })
    expect(execute).toHaveBeenLastCalledWith('powershell.exe', expect.any(Array), expect.objectContaining({ timeout: 10_000, cancelSignal: signal }))
    await assertWechatDevtoolsHost(target(), { platform: 'win32', timeout: 500, signal })
    expect(execute).toHaveBeenLastCalledWith('powershell.exe', expect.any(Array), expect.objectContaining({ timeout: 500, cancelSignal: signal }))
    await assertWechatDevtoolsHost(target(), { platform: 'win32', timeout: 60_000 })
    expect(execute).toHaveBeenLastCalledWith('powershell.exe', expect.any(Array), expect.objectContaining({ timeout: 10_000 }))
    const controller = new AbortController()
    controller.abort(new Error('inspection cancelled'))
    await expect(assertWechatDevtoolsHost(target(), { platform: 'win32', signal: controller.signal })).rejects.toThrow('inspection cancelled')
    expect(execute).toHaveBeenCalledTimes(3)
  })

  it.each([0, -1, Number.NaN])('rejects an invalid inspection budget %s before launching a process', async (timeout) => {
    await expect(assertWechatDevtoolsHost(target(), { platform: 'win32', timeout })).rejects.toMatchObject({
      code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH',
      cause: { name: 'RangeError', message: 'DevTools inspection timeout must be positive.' },
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('reads the Linux executable from procfs instead of treating a short comm name as its path', async () => {
    const selected = { ...target(), cliPath: path.join(root, 'selected', 'cli'), appPath: path.join(root, 'selected', 'resources', 'app.asar') }
    execute.mockImplementation(async command => command === 'lsof'
      ? { exitCode: 0, stdout: `p${process.pid}\n` }
      : { exitCode: 0, stdout: 'wechatdevtools' })
    const readLink = vi.spyOn(fs, 'readlink').mockResolvedValue(path.join(root, 'selected', 'wechatdevtools'))
    await assertWechatDevtoolsPort(selected, 22001, { platform: 'linux' })
    expect(readLink).toHaveBeenCalledWith(`/proc/${process.pid}/exe`)
    expect(execute.mock.calls.map(([command]) => command)).toEqual(['lsof'])
    readLink.mockResolvedValueOnce(path.join(root, 'other', 'wechatdevtools'))
    await expect(assertWechatDevtoolsPort(selected, 22001, { platform: 'linux' })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
  })
})
