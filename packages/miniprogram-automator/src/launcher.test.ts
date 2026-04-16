/**
 * @file 启动器测试。
 */
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn(async () => undefined))
const readFileMock = vi.hoisted(() => vi.fn(async () => '{}'))
const writeFileMock = vi.hoisted(() => vi.fn(async () => undefined))
const getPortMock = vi.hoisted(() => vi.fn(async (value: number) => value))
const waitUntilMock = vi.hoisted(() => vi.fn(async (condition: () => unknown | Promise<unknown>, timeout = 0) => {
  const startTime = Date.now()
  while (true) {
    const value = await condition()
    if (value) {
      return value
    }
    if (timeout && Date.now() - startTime >= timeout) {
      throw new Error(`Wait timed out after ${timeout} ms`)
    }
  }
}))
const sleepMock = vi.hoisted(() => vi.fn(async () => {}))
const connectCreateMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

vi.mock('node:fs/promises', () => ({
  access: accessMock,
  readFile: readFileMock,
  writeFile: writeFileMock,
}))

vi.mock('./Connection', () => ({
  default: {
    create: connectCreateMock,
  },
}))

async function loadLauncherModule(isWindows = false) {
  vi.resetModules()
  vi.doMock('./internal/compat', async () => {
    const actual = await vi.importActual<typeof import('./internal/compat')>('./internal/compat')
    return {
      ...actual,
      getPort: getPortMock,
      sleep: sleepMock,
      waitUntil: waitUntilMock,
      isWindows,
    }
  })

  return await import('./Launcher')
}

describe('Launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe'
  })

  afterEach(() => {
    delete process.env.WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER
    delete process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER
  })

  it('connects to the websocket endpoint and checks version', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const checkVersion = vi.fn(async () => {})
    connectCreateMock.mockResolvedValueOnce({ transport: true })
    const launcher = new Launcher()
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({ checkVersion })

    const result = await launcher.connect({ wsEndpoint: 'ws://127.0.0.1:1234' })

    expect(checkVersion).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ checkVersion })
  })

  it('rejects occupied custom ports before spawning', async () => {
    const { default: Launcher } = await loadLauncherModule()
    getPortMock.mockResolvedValueOnce(10000)
    const launcher = new Launcher()

    await expect(launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      port: 9420,
      projectPath: '/tmp/project',
    })).rejects.toThrow('Port 9420 is in use')
  })

  it('spawns the cli and connects to the computed endpoint', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)
    const launcher = new Launcher()
    const checkVersion = vi.fn(async () => {})
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({ checkVersion })

    const result = await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
      account: 'tester',
      trustProject: true,
    })

    expect(spawnMock).toHaveBeenCalledWith('/Applications/wechatwebdevtools.app/Contents/MacOS/cli', [
      'auto',
      '--project',
      '/tmp/project',
      '--auto-port',
      '9420',
      '--auto-account',
      'tester',
      '--trust-project',
    ], {
      stdio: 'ignore',
      cwd: undefined,
    })
    expect(checkVersion).toHaveBeenCalledTimes(1)
    expect(sleepMock).toHaveBeenCalledWith(5000)
    expect(result).toEqual({
      checkVersion,
      __WEAPP_VITE_SESSION_METADATA: {
        port: 9420,
        projectPath: '/tmp/project',
        wsEndpoint: 'ws://127.0.0.1:9420',
      },
    })
  })

  it('launches batch cli through the Windows shell', async () => {
    const { default: Launcher } = await loadLauncherModule(true)
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)
    const launcher = new Launcher()
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({ checkVersion: vi.fn(async () => {}) })

    await launcher.launch({
      cliPath: 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat',
      projectPath: '/tmp/project',
    })

    expect(spawnMock).toHaveBeenCalledWith('C:\\Windows\\System32\\cmd.exe', [
      '/d',
      '/s',
      '/c',
      '""C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" auto --project /tmp/project --auto-port 9420"',
    ], {
      stdio: 'ignore',
      cwd: undefined,
      windowsHide: true,
      windowsVerbatimArguments: true,
    })
  })

  it('retries websocket validation when devtools extension context is still reloading', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)

    const disconnect = vi.fn()
    const firstCandidate = {
      checkVersion: vi.fn(async () => {
        throw new Error('Extension context invalidated.')
      }),
      disconnect,
    }
    const secondCandidate = {
      checkVersion: vi.fn(async () => {}),
    }

    const launcher = new Launcher()
    const connectToolSpy = vi.spyOn(launcher as any, 'connectTool')
    connectToolSpy
      .mockResolvedValueOnce(firstCandidate)
      .mockResolvedValueOnce(secondCandidate)

    const result = await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
    })

    expect(connectToolSpy).toHaveBeenCalledTimes(2)
    expect(firstCandidate.checkVersion).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(secondCandidate.checkVersion).toHaveBeenCalledTimes(1)
    expect(result).toEqual(secondCandidate)
  })

  it('keeps waiting for websocket readiness after cli exits with code 0', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)

    const launcher = new Launcher()
    const firstError = new Error('Failed connecting to ws://127.0.0.1:9420, check if target project window is opened with automation enabled')
    const secondCandidate = {
      checkVersion: vi.fn(async () => {}),
    }

    const connectToolSpy = vi.spyOn(launcher as any, 'connectTool')
    connectToolSpy
      .mockImplementationOnce(async () => {
        child.emit('exit', 0, null)
        throw firstError
      })
      .mockResolvedValueOnce(secondCandidate)

    const result = await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
    })

    expect(connectToolSpy).toHaveBeenCalledTimes(2)
    expect(secondCandidate.checkVersion).toHaveBeenCalledTimes(1)
    expect(result).toEqual(secondCandidate)
  })

  it('fails fast when cli exits with a non-zero code', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)

    const launcher = new Launcher()
    vi.spyOn(launcher as any, 'connectTool').mockImplementationOnce(async () => {
      child.emit('exit', 1, null)
      throw new Error('Failed connecting to ws://127.0.0.1:9420, check if target project window is opened with automation enabled')
    })

    await expect(launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
    })).rejects.toThrow('Failed to launch wechat web devTools, please make sure cliPath is correctly specified')
  })

  it('extends project config before launch when overrides are provided', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)
    readFileMock.mockResolvedValueOnce(JSON.stringify({ appid: 'old', setting: { a: 1 } }))
    const launcher = new Launcher()
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({ checkVersion: vi.fn(async () => {}) })

    await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
      projectConfig: {
        setting: { b: 2 },
      },
    })

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('project.config.json'),
      JSON.stringify({ appid: 'old', setting: { a: 1, b: 2 } }, null, 2),
      'utf8',
    )
  })

  it('uses environment runtime provider for headless launch', async () => {
    process.env.WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER = 'headless'
    vi.doMock('./headless', () => ({
      launchHeadlessAutomator: vi.fn(async () => ({ provider: 'headless' })),
    }))
    const { default: Launcher } = await loadLauncherModule()
    const launcher = new Launcher()

    await expect(launcher.launch({ projectPath: '/tmp/project' })).resolves.toEqual({ provider: 'headless' })
  })
})
