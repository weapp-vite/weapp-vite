import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEFAULT_WECHAT_CLI_PATH = process.platform === 'win32'
  ? 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
  : '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

const { cleanupResidualDevtoolsProcessesMock, connectMock, execaMock, launchMock, openWechatIdeProjectByHttpMock, resetWechatIdeFileUtilsByHttpMock, runWechatIdeEngineBuildByHttpMock, scanRecentDevtoolsSimulatorBootIssuesMock, MockMiniProgram } = vi.hoisted(() => {
  class MockMiniProgramClass {
    send = vi.fn(async () => ({ SDKVersion: '3.13.2' }))
  }
  return {
    cleanupResidualDevtoolsProcessesMock: vi.fn(async () => {}),
    connectMock: vi.fn(),
    execaMock: vi.fn(),
    launchMock: vi.fn(),
    openWechatIdeProjectByHttpMock: vi.fn(async () => ''),
    resetWechatIdeFileUtilsByHttpMock: vi.fn(async () => ''),
    runWechatIdeEngineBuildByHttpMock: vi.fn(async () => ({ body: '{"status":"END"}', done: true, failed: false, status: 'END' })),
    scanRecentDevtoolsSimulatorBootIssuesMock: vi.fn(() => []),
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
    openWechatIdeProjectByHttp: openWechatIdeProjectByHttpMock,
    resetWechatIdeFileUtilsByHttp: resetWechatIdeFileUtilsByHttpMock,
  }
})

vi.mock('../../packages/weapp-ide-cli/src/cli/engine', () => {
  return {
    runWechatIdeEngineBuildByHttp: runWechatIdeEngineBuildByHttpMock,
  }
})

vi.mock('../utils/ide-devtools-cleanup', () => {
  return {
    cleanupResidualDevtoolsProcesses: cleanupResidualDevtoolsProcessesMock,
  }
})

vi.mock('../utils/ide-devtools-logs', () => {
  return {
    scanRecentDevtoolsSimulatorBootIssues: scanRecentDevtoolsSimulatorBootIssuesMock,
  }
})

interface MockPage {
  path?: string
  waitFor: ReturnType<typeof vi.fn>
  $: ReturnType<typeof vi.fn>
  $$: ReturnType<typeof vi.fn>
}

interface MockMiniProgramRuntime {
  compile: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  currentPage: ReturnType<typeof vi.fn>
  reLaunch: ReturnType<typeof vi.fn>
  __rawCompile: ReturnType<typeof vi.fn>
  __rawClose: ReturnType<typeof vi.fn>
  __rawCurrentPage: ReturnType<typeof vi.fn>
  __rawReLaunch: ReturnType<typeof vi.fn>
}

function createMockPage(pagePath = 'pages/index/index'): MockPage {
  return {
    path: pagePath,
    waitFor: vi.fn(async () => {}),
    $: vi.fn(async () => ({ tag: 'page-root' })),
    $$: vi.fn(async () => [{ tag: 'page-root' }]),
  }
}

function createMockMiniProgram(options?: { currentPage?: MockPage, reLaunchError?: Error }): MockMiniProgramRuntime {
  const page = createMockPage()
  const rawCompile = vi.fn(async () => {})
  const rawClose = vi.fn(async () => {})
  const rawCurrentPage = vi.fn(async () => options?.currentPage ?? page)
  const rawReLaunch = options?.reLaunchError
    ? vi.fn(async () => {
        throw options.reLaunchError
      })
    : vi.fn(async () => page)
  return {
    compile: rawCompile,
    on: vi.fn(),
    removeListener: vi.fn(),
    close: rawClose,
    currentPage: rawCurrentPage,
    reLaunch: rawReLaunch,
    __rawCompile: rawCompile,
    __rawClose: rawClose,
    __rawCurrentPage: rawCurrentPage,
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
    writeJson(path.join(projectRoot, 'dist/app.json'), {
      subPackages: [],
      ...appJson,
    })
  }
}

function clearLaunchEnv() {
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
  delete process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES
  delete process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY
  delete process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_TOOL_COMPILE_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_RELUNCH_RETRIES
  delete process.env.WEAPP_VITE_E2E_RELUNCH_RETRY_DELAY
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP
  delete process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY
  delete process.env.WEAPP_VITE_E2E_BRIDGE_WARMUP_READY_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY
}

describe.sequential('automator launch resilience', () => {
  let sandboxRoot = ''

  beforeEach(() => {
    sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-automator-launch-'))
    cleanupResidualDevtoolsProcessesMock.mockReset()
    connectMock.mockReset()
    execaMock.mockReset()
    launchMock.mockReset()
    openWechatIdeProjectByHttpMock.mockReset()
    resetWechatIdeFileUtilsByHttpMock.mockReset()
    runWechatIdeEngineBuildByHttpMock.mockReset()
    scanRecentDevtoolsSimulatorBootIssuesMock.mockReset()
    cleanupResidualDevtoolsProcessesMock.mockResolvedValue(undefined)
    openWechatIdeProjectByHttpMock.mockResolvedValue('')
    resetWechatIdeFileUtilsByHttpMock.mockResolvedValue('')
    runWechatIdeEngineBuildByHttpMock.mockResolvedValue({
      body: '{"status":"END"}',
      done: true,
      failed: false,
      status: 'END',
    })
    scanRecentDevtoolsSimulatorBootIssuesMock.mockReturnValue([])
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
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    const miniProgram = await launchAutomator({ projectPath: sandboxRoot })

    expect(miniProgram).toBeTruthy()
    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('cleans devtools compile cache before retrying launch timeout', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const secondMiniProgram = createMockMiniProgram()
    launchMock
      .mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 6_000))
        return createMockMiniProgram()
      })
      .mockResolvedValueOnce(secondMiniProgram)
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
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

  it('retries when warmup current page never becomes ready and closes previous miniProgram', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.currentPage = firstMiniProgram.__rawCurrentPage = vi.fn(async () => undefined)
    const secondMiniProgram = createMockMiniProgram()

    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
  })

  it('retries when WeChat DevTools log reports simulator subPackages boot error during warmup', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const firstMiniProgram = createMockMiniProgram()
    const secondMiniProgram = createMockMiniProgram()
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })
    scanRecentDevtoolsSimulatorBootIssuesMock
      .mockReturnValueOnce([{
        file: 'devtools.log',
        line: '[ERROR] simulator launch catch error TypeError: Cannot read property \'subPackages\' of undefined',
      }])
      .mockReturnValue([])

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
  })

  it('reopens devtools project when warmup current page hangs', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.currentPage = firstMiniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return createMockPage()
      })
    const secondMiniProgram = createMockMiniProgram()
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
  })

  it('accepts warmup timeout when devtools already switched to the target page', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const page = createMockPage('/pages/index/index')
    const miniProgram = createMockMiniProgram({
      currentPage: page,
    })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return page
      })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })

    expect(launchMock).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawClose).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.anything())
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
  })

  it('can disable current-page fast path for relaunch after launch', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const currentPage = createMockPage('/pages/index/index')
    const relaunchedPage = createMockPage('/pages/index/index')
    const miniProgram = createMockMiniProgram({
      currentPage,
    })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => relaunchedPage)
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launchedMiniProgram = await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })
    delete process.env.WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY
    await launchedMiniProgram.reLaunch('/pages/index/index')

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('escalates warmup recovery from compile cache to all cache in one launch sequence', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '3'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.currentPage = firstMiniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return createMockPage()
      })
    const secondMiniProgram = createMockMiniProgram()
    secondMiniProgram.currentPage = secondMiniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return createMockPage()
      })
    const thirdMiniProgram = createMockMiniProgram()
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
      .mockResolvedValueOnce(thirdMiniProgram)
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })

    expect(launchMock).toHaveBeenCalledTimes(3)
    expect(execaMock).toHaveBeenNthCalledWith(1, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(execaMock).toHaveBeenNthCalledWith(2, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'all'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(2)
    expect(thirdMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(thirdMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('keeps one project reopen retry after compile and all cache recovery are exhausted', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '4'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.currentPage = firstMiniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return createMockPage()
      })
    const secondMiniProgram = createMockMiniProgram()
    secondMiniProgram.currentPage = secondMiniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return createMockPage()
      })
    const thirdMiniProgram = createMockMiniProgram()
    thirdMiniProgram.currentPage = thirdMiniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80))
        return createMockPage()
      })
    const fourthMiniProgram = createMockMiniProgram()
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
      .mockResolvedValueOnce(thirdMiniProgram)
      .mockResolvedValueOnce(fourthMiniProgram)
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })

    expect(launchMock).toHaveBeenCalledTimes(4)
    expect(execaMock).toHaveBeenNthCalledWith(1, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(execaMock).toHaveBeenNthCalledWith(2, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'all'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(3)
    expect(fourthMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(fourthMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
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
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
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
    expect(firstMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(firstMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('uses cli engine build when removed devtools http engine build endpoint is unavailable', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValueOnce(miniProgram)
    runWechatIdeEngineBuildByHttpMock.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(runWechatIdeEngineBuildByHttpMock).toHaveBeenCalledTimes(1)
    expect(execaMock).toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.objectContaining({
        reject: false,
        timeout: 70_000,
      }),
    )
    expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('continues when cli engine build opens project but exits non-zero', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValueOnce(miniProgram)
    runWechatIdeEngineBuildByHttpMock.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '- 打开项目中\n✔ 打开项目成功\n✖ 打开项目中',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(execaMock).toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.objectContaining({
        reject: false,
        timeout: 70_000,
      }),
    )
    expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('skips unsupported tool compile method and still completes warmup launch', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    miniProgram.compile.mockRejectedValueOnce(new Error('unimplemented'))
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('skips timed out tool compile method and still completes warmup launch', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_TOOL_COMPILE_TIMEOUT = '20'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    miniProgram.compile.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 40_000))
    })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('refreshes the opened devtools project before fileutils reset when explicitly enabled', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledWith(sandboxRoot)
    expect(openWechatIdeProjectByHttpMock.mock.invocationCallOrder[0]).toBeLessThan(
      resetWechatIdeFileUtilsByHttpMock.mock.invocationCallOrder[0]!,
    )
    expect(resetWechatIdeFileUtilsByHttpMock.mock.invocationCallOrder[0]).toBeLessThan(
      miniProgram.__rawCurrentPage.mock.invocationCallOrder[0]!,
    )
  })

  it('uses explicit warmup route when launch options provide one', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({
      projectPath: sandboxRoot,
      warmupRoute: '/subpackages/lab/class-binding/index',
    })

    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('does not rewrite project config when launch options do not pass projectConfig', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(launchMock.mock.calls[0]?.[0]).not.toHaveProperty('projectConfig')
  })

  it('honors per-launch skip warmup option and still wraps relaunch recovery', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const currentPage = createMockPage('/pages/index/index')
    const relaunchedPage = createMockPage('/pages/index/index')
    const miniProgram = createMockMiniProgram({
      currentPage,
    })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => relaunchedPage)
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launchedMiniProgram = await launchAutomator({
      projectPath: sandboxRoot,
      skipWarmup: true,
    })

    expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()

    await expect(launchedMiniProgram.reLaunch('/pages/index/index')).resolves.toBe(relaunchedPage)

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('can skip relaunch page root checks per launch', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const relaunchedPage = createMockPage('/pages/index/index')
    relaunchedPage.$ = vi.fn(async () => null)
    relaunchedPage.$$ = vi.fn(async () => [])
    const miniProgram = createMockMiniProgram()
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => relaunchedPage)
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launchedMiniProgram = await launchAutomator({
      projectPath: sandboxRoot,
      skipRelaunchPageRootCheck: true,
    })

    await expect(launchedMiniProgram.reLaunch('/pages/index/index')).resolves.toBe(relaunchedPage)

    expect(relaunchedPage.$).not.toHaveBeenCalledWith('page')
    expect(relaunchedPage.$$).not.toHaveBeenCalledWith('page')
  })

  it('uses cli bridge mode for ide launches and connects via websocket endpoint', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
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
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('does not refresh project index after bridge connection by default', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
      stderr: '',
    })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)
    runWechatIdeEngineBuildByHttpMock.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(execaMock).not.toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.anything(),
    )
    expect(resetWechatIdeFileUtilsByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(connectedMiniProgram.__rawCompile).not.toHaveBeenCalled()
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('retries cli bridge launch when homepage never becomes ready', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    firstMiniProgram.currentPage = firstMiniProgram.__rawCurrentPage = vi.fn(async () => undefined)
    const secondMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9421' }),
        stderr: '',
      })
    connectMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(connectMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(execaMock).toHaveBeenNthCalledWith(2, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('accepts any booted current page during cli bridge warmup', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_BRIDGE_WARMUP_READY_TIMEOUT = '20'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index', 'pages/layouts/index'],
    })

    const connectedMiniProgram = createMockMiniProgram({
      currentPage: createMockPage('pages/index/index'),
    })
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
      stderr: '',
    })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({
      projectPath: sandboxRoot,
      timeout: 12_345,
      warmupRoute: '/pages/layouts/index',
    })

    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('can prebuild project index before connecting through cli bridge', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
        stderr: '',
      })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(execaMock).toHaveBeenNthCalledWith(
      1,
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.objectContaining({
        reject: false,
        timeout: 70_000,
      }),
    )
    expect(execaMock).toHaveBeenNthCalledWith(2, 'node', expect.any(Array), expect.objectContaining({
      reject: false,
      timeout: 12_345,
    }))
    expect(connectMock).toHaveBeenCalledWith({
      wsEndpoint: 'ws://127.0.0.1:9420',
    })
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('does not prebuild project index by default for cli bridge launch', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
      stderr: '',
    })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(execaMock).not.toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.anything(),
    )
    expect(execaMock).toHaveBeenNthCalledWith(1, 'node', expect.any(Array), expect.objectContaining({
      reject: false,
      timeout: 12_345,
    }))
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('retries launch when devtools http reset fails through a wrapped connection error', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstMiniProgram = createMockMiniProgram()
    const secondMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
    const connectionError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:62544'), {
      code: 'ECONNREFUSED',
    })
    const fetchError = Object.assign(new TypeError('fetch failed'), {
      cause: connectionError,
    })
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9411' }),
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9412' }),
        stderr: '',
      })
    connectMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    resetWechatIdeFileUtilsByHttpMock
      .mockRejectedValueOnce(fetchError)
      .mockResolvedValue('')

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    expect(connectMock).toHaveBeenCalledTimes(2)
    expect(resetWechatIdeFileUtilsByHttpMock).toHaveBeenCalledTimes(2)
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('cleans devtools compile cache and retries when cli bridge exits with path undefined error', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const connectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
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
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('closes the current runtime session after simulator boot error during relaunch', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn()
      .mockRejectedValueOnce(new Error('[] simulator not found\nError: simulator not found'))
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launched = await launchAutomator({ projectPath: sandboxRoot })

    resetWechatIdeFileUtilsByHttpMock.mockClear()
    runWechatIdeEngineBuildByHttpMock.mockClear()
    miniProgram.__rawCompile.mockClear()

    await expect(launched.reLaunch('/pages/index/index')).rejects.toThrow('simulator not found')

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(resetWechatIdeFileUtilsByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(miniProgram.__rawCompile).not.toHaveBeenCalled()
  })

  it('does not reuse the current page when relaunch target includes query', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const currentPage = createMockPage()
    const relaunchedPage = createMockPage()
    const miniProgram = createMockMiniProgram({ currentPage })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => relaunchedPage)
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launched = await launchAutomator({ projectPath: sandboxRoot })

    await expect(launched.reLaunch('/pages/index/index?from=e2e')).resolves.toBe(relaunchedPage)

    expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index?from=e2e')
  })

  it('closes the current runtime session when raw relaunch times out without reaching target page', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'
    process.env.WEAPP_VITE_E2E_RELUNCH_RETRIES = '3'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    miniProgram.currentPage = miniProgram.__rawCurrentPage = vi.fn(async () => undefined)
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 80))
      return createMockPage()
    })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launched = await launchAutomator({ projectPath: sandboxRoot })

    resetWechatIdeFileUtilsByHttpMock.mockClear()
    runWechatIdeEngineBuildByHttpMock.mockClear()
    miniProgram.__rawCompile.mockClear()

    await expect(launched.reLaunch('/pages/index/index')).rejects.toThrow('Timeout in raw reLaunch')

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(resetWechatIdeFileUtilsByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(miniProgram.__rawCompile).not.toHaveBeenCalled()
  })

  it('closes the current runtime session when relaunch page root never becomes ready', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const page = createMockPage()
    page.$ = vi.fn(async () => null)
    page.$$ = vi.fn(async () => [])
    const miniProgram = createMockMiniProgram({ currentPage: page })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => page)
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launched = await launchAutomator({ projectPath: sandboxRoot })

    resetWechatIdeFileUtilsByHttpMock.mockClear()
    runWechatIdeEngineBuildByHttpMock.mockClear()
    miniProgram.__rawCompile.mockClear()

    await expect(launched.reLaunch('/pages/index/index')).rejects.toThrow('Timed out waiting page root')

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(resetWechatIdeFileUtilsByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(miniProgram.__rawCompile).not.toHaveBeenCalled()
  })
})
