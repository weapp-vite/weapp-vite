import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEFAULT_WECHAT_CLI_PATH = process.platform === 'win32'
  ? 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
  : '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

const { connectMock, execaMock, launchMock, resetWechatIdeFileUtilsByHttpMock, runWechatIdeEngineBuildByHttpMock, MockMiniProgram } = vi.hoisted(() => {
  class MockMiniProgramClass {
    send = vi.fn(async () => ({ SDKVersion: '3.13.2' }))
  }
  return {
    connectMock: vi.fn(),
    execaMock: vi.fn(),
    launchMock: vi.fn(),
    resetWechatIdeFileUtilsByHttpMock: vi.fn(async () => ''),
    runWechatIdeEngineBuildByHttpMock: vi.fn(async () => ({ body: '{"status":"END"}', done: true, failed: false, status: 'END' })),
    MockMiniProgram: MockMiniProgramClass,
  }
})

vi.mock('@weapp-vite/miniprogram-automator', () => {
  return {
    Automator: class {
      connect = connectMock
      launch = launchMock
    },
    MiniProgram: MockMiniProgram,
  }
})

vi.mock('execa', () => {
  return {
    execa: execaMock,
  }
})

vi.mock('../../packages/weapp-ide-cli/src/cli/http', () => {
  return {
    resetWechatIdeFileUtilsByHttp: resetWechatIdeFileUtilsByHttpMock,
  }
})

vi.mock('../../packages/weapp-ide-cli/src/cli/engine', () => {
  return {
    runWechatIdeEngineBuildByHttp: runWechatIdeEngineBuildByHttpMock,
  }
})

interface MockPage {
  waitFor: ReturnType<typeof vi.fn>
  $: ReturnType<typeof vi.fn>
  $$: ReturnType<typeof vi.fn>
}

interface MockMiniProgramRuntime {
  on: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  reLaunch: ReturnType<typeof vi.fn>
  __rawClose: ReturnType<typeof vi.fn>
  __rawReLaunch: ReturnType<typeof vi.fn>
}

function createMockPage(): MockPage {
  return {
    waitFor: vi.fn(async () => {}),
    $: vi.fn(async () => ({ tag: 'page-root' })),
    $$: vi.fn(async () => [{ tag: 'page-root' }]),
  }
}

function createMockMiniProgram(options?: { reLaunchError?: Error }): MockMiniProgramRuntime {
  const page = createMockPage()
  const rawClose = vi.fn(async () => {})
  const rawReLaunch = options?.reLaunchError
    ? vi.fn(async () => {
        throw options.reLaunchError
      })
    : vi.fn(async () => page)
  return {
    on: vi.fn(),
    removeListener: vi.fn(),
    close: rawClose,
    reLaunch: rawReLaunch,
    __rawClose: rawClose,
    __rawReLaunch: rawReLaunch,
  }
}

function writeJson(target: string, value: Record<string, any>) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(value, null, 2))
}

function createProjectFixture(projectRoot: string, appJson?: Record<string, any>) {
  writeJson(path.join(projectRoot, 'project.config.json'), {
    appid: 'wxb3d842a4a7e3440d',
    miniprogramRoot: 'dist',
  })
  if (appJson) {
    writeJson(path.join(projectRoot, 'dist/app.json'), appJson)
  }
}

function clearLaunchEnv() {
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
  delete process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES
  delete process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY
  delete process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT
}

describe.sequential('automator launch resilience', () => {
  let sandboxRoot = ''

  beforeEach(() => {
    sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-automator-launch-'))
    connectMock.mockReset()
    execaMock.mockReset()
    launchMock.mockReset()
    resetWechatIdeFileUtilsByHttpMock.mockReset()
    runWechatIdeEngineBuildByHttpMock.mockReset()
    resetWechatIdeFileUtilsByHttpMock.mockResolvedValue('')
    runWechatIdeEngineBuildByHttpMock.mockResolvedValue({
      body: '{"status":"END"}',
      done: true,
      failed: false,
      status: 'END',
    })
    clearLaunchEnv()
  })

  afterEach(() => {
    clearLaunchEnv()
    vi.resetModules()
    fs.rmSync(sandboxRoot, { recursive: true, force: true })
  })

  it('retries launch when simulator boot throws subPackages undefined error', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const firstError = new Error('模拟器启动失败 TypeError: Cannot read property \'subPackages\' of undefined')
    const secondMiniProgram = createMockMiniProgram()
    launchMock
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const miniProgram = await launchAutomator({ projectPath: sandboxRoot })

    expect(miniProgram).toBeTruthy()
    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(secondMiniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('does not retry launch on login-required error', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '3'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    launchMock.mockRejectedValueOnce(new Error('code: 10 need re-login'))

    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({ projectPath: sandboxRoot })).rejects.toMatchObject({
      name: 'WechatIdeLoginRequiredError',
      code: 10,
    })
    expect(launchMock).toHaveBeenCalledTimes(1)
  })

  it('retries when warmup reLaunch fails and closes previous miniProgram', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram({
      reLaunchError: new Error('Execution context was destroyed'),
    })
    const secondMiniProgram = createMockMiniProgram()

    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('retries when runtime log listener binding hits a transient connection closed error', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.on.mockImplementation(() => {
      throw new Error('Connection closed, check if wechat web devTools is still running')
    })
    const secondMiniProgram = createMockMiniProgram()

    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('ignores async runtime log enable rejection caused by connection closed', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.on.mockRejectedValueOnce(new Error('Connection closed, check if wechat web devTools is still running'))
    launchMock.mockResolvedValueOnce(firstMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(launchMock).toHaveBeenCalledTimes(1)
    expect(firstMiniProgram.__rawClose).not.toHaveBeenCalled()
    expect(firstMiniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('uses cli bridge mode for ide launches and connects via websocket endpoint', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram()
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
      stderr: '',
    })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(launchMock).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith({
      wsEndpoint: 'ws://127.0.0.1:9420',
    })
    expect(connectedMiniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('cleans devtools compile cache and retries when cli bridge exits with path undefined error', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram()
    execaMock
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received undefined\n    at SummerCompiler._getPackageFiles (...)',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9527' }),
        stderr: '',
      })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(execaMock).toHaveBeenNthCalledWith(1, 'node', expect.any(Array), expect.objectContaining({
      reject: false,
      timeout: 12_345,
    }))
    expect(execaMock).toHaveBeenNthCalledWith(2, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(execaMock).toHaveBeenNthCalledWith(3, 'node', expect.any(Array), expect.objectContaining({
      reject: false,
      timeout: 12_345,
    }))
    expect(connectMock).toHaveBeenCalledWith({
      wsEndpoint: 'ws://127.0.0.1:9527',
    })
    expect(connectedMiniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })
})
