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
const acquirePortLeaseMock = vi.hoisted(() => vi.fn(async (port?: number) => ({
  port: port ?? 9420,
  release: vi.fn(async () => {}),
})))
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
const swanLaunchMock = vi.hoisted(() => vi.fn(async (options: unknown) => ({ provider: 'swan', options })))
const swanConnectMock = vi.hoisted(() => vi.fn(async (options: unknown) => ({ provider: 'swan', options })))
const swanLauncherMock = vi.hoisted(() => vi.fn(function MockSwanLauncher(this: any) {
  this.connect = swanConnectMock
  this.launch = swanLaunchMock
}))

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

vi.mock('./launcher/portLease', () => ({
  acquireAutomatorPortLease: acquirePortLeaseMock,
}))

vi.mock('./SwanLauncher', () => ({
  default: swanLauncherMock,
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
    acquirePortLeaseMock.mockImplementation(async (port?: number) => ({
      port: port ?? 9420,
      release: vi.fn(async () => {}),
    }))
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

  it('passes explicit connect timeout to websocket creation', async () => {
    const { default: Launcher } = await loadLauncherModule()
    connectCreateMock.mockResolvedValueOnce(new EventEmitter())
    const launcher = new Launcher()

    await (launcher as any).connectTool({
      timeout: 1_234,
      wsEndpoint: 'ws://127.0.0.1:1234',
    }).catch(() => {})

    expect(connectCreateMock).toHaveBeenCalledWith('ws://127.0.0.1:1234', 1_234)
  })

  it('rejects occupied custom ports before spawning', async () => {
    const { default: Launcher } = await loadLauncherModule()
    acquirePortLeaseMock.mockRejectedValueOnce(new Error('Port 9420 is in use, please specify another port'))
    const launcher = new Launcher()

    await expect(launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      port: 9420,
      projectPath: '/tmp/project',
    })).rejects.toThrow('Port 9420 is in use')
  })

  it('retries automatic launch on websocket port conflicts with a new lease', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)
    acquirePortLeaseMock
      .mockResolvedValueOnce({ port: 9420, release: vi.fn(async () => {}) })
      .mockResolvedValueOnce({ port: 9421, release: vi.fn(async () => {}) })
    const launcher = new Launcher()
    const rawWaitUntil = waitUntilMock.getMockImplementation()!
    waitUntilMock
      .mockRejectedValueOnce(new Error('Wait timed out after 1 ms'))
      .mockImplementationOnce(rawWaitUntil)
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({ checkVersion: vi.fn(async () => {}) })

    await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
      timeout: 1,
    })

    expect(acquirePortLeaseMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[1]?.[1]).toContain('9421')
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
    expect((launcher as any).connectTool).toHaveBeenCalledWith({
      timeout: 3_000,
      wsEndpoint: 'ws://127.0.0.1:9420',
    })
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

  it('keeps the automatic port lease until the launched session closes', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)
    const release = vi.fn(async () => {})
    acquirePortLeaseMock.mockResolvedValueOnce({ port: 9420, release })
    const rawDisconnect = vi.fn()
    const rawClose = vi.fn(async function close(this: { disconnect: () => void }) {
      this.disconnect()
    })
    const launcher = new Launcher()
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({
      checkVersion: vi.fn(async () => {}),
      close: rawClose,
      disconnect: rawDisconnect,
    })

    const result = await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
    })

    expect(release).not.toHaveBeenCalled()

    await result.close()
    await result.close()

    expect(rawClose).toHaveBeenCalledTimes(2)
    expect(rawDisconnect).toHaveBeenCalledTimes(2)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases the automatic port lease when the launched session disconnects', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValue(child)
    const release = vi.fn(async () => {})
    acquirePortLeaseMock.mockResolvedValueOnce({ port: 9420, release })
    const rawDisconnect = vi.fn()
    const launcher = new Launcher()
    vi.spyOn(launcher as any, 'connectTool').mockResolvedValueOnce({
      checkVersion: vi.fn(async () => {}),
      disconnect: rawDisconnect,
    })

    const result = await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
    })

    expect(release).not.toHaveBeenCalled()

    result.disconnect()
    result.disconnect()

    expect(rawDisconnect).toHaveBeenCalledTimes(2)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('delegates swan launch to the swan launcher', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const launcher = new Launcher()

    await expect(launcher.launch({
      platform: 'swan',
      cliPath: '/Applications/swan-ide/cli',
      projectPath: '/tmp/swan-project',
    })).resolves.toEqual({
      provider: 'swan',
      options: {
        platform: 'swan',
        cliPath: '/Applications/swan-ide/cli',
        projectPath: '/tmp/swan-project',
      },
    })

    expect(spawnMock).not.toHaveBeenCalled()
    expect(swanLaunchMock).toHaveBeenCalledWith({
      platform: 'swan',
      cliPath: '/Applications/swan-ide/cli',
      projectPath: '/tmp/swan-project',
    })
  })

  it('accepts baidu as an alias of swan platform', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const launcher = new Launcher()

    await expect(launcher.connect({
      platform: 'baidu',
      wsEndpoint: 'ws://127.0.0.1:8888',
    })).resolves.toEqual({
      provider: 'swan',
      options: {
        platform: 'baidu',
        wsEndpoint: 'ws://127.0.0.1:8888',
      },
    })

    expect(connectCreateMock).not.toHaveBeenCalled()
    expect(swanConnectMock).toHaveBeenCalledWith({
      platform: 'baidu',
      wsEndpoint: 'ws://127.0.0.1:8888',
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

  it('retries automatic launch when cli exits before the automator socket is ready', async () => {
    const { default: Launcher } = await loadLauncherModule()
    const firstChild = new EventEmitter() as EventEmitter & { unref: () => void }
    const secondChild = new EventEmitter() as EventEmitter & { unref: () => void }
    firstChild.unref = vi.fn()
    secondChild.unref = vi.fn()
    spawnMock
      .mockReturnValueOnce(firstChild)
      .mockReturnValueOnce(secondChild)
    acquirePortLeaseMock
      .mockResolvedValueOnce({ port: 9420, release: vi.fn(async () => {}) })
      .mockResolvedValueOnce({ port: 9421, release: vi.fn(async () => {}) })

    const launcher = new Launcher()
    const connectToolSpy = vi.spyOn(launcher as any, 'connectTool')
    connectToolSpy
      .mockImplementationOnce(async () => {
        firstChild.emit('exit', 1, null)
        throw new Error('Failed connecting to ws://127.0.0.1:9420, check if target project window is opened with automation enabled')
      })
      .mockResolvedValueOnce({ checkVersion: vi.fn(async () => {}) })

    await launcher.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/tmp/project',
    })

    expect(acquirePortLeaseMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[0]?.[1]).toContain('9420')
    expect(spawnMock.mock.calls[1]?.[1]).toContain('9421')
  })

  it('fails fast when a custom port launch cli exits with a non-zero code', async () => {
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
      port: 9420,
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
