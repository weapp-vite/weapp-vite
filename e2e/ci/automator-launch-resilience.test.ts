import type { WechatDevtoolsHttpCommandOptions } from '../../packages/weapp-ide-cli/src/cli/http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEFAULT_WECHAT_CLI_PATH = process.platform === 'win32'
  ? 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
  : '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

const { captureDevtoolsLogBaselineMock, cleanupResidualDevtoolsProcessesMock, connectMock, execaMock, launchMock, openWechatIdeProjectByHttpMock, resetWechatIdeFileUtilsByHttpMock, runWechatIdeEngineBuildByHttpMock, scanRecentDevtoolsSimulatorBootIssuesMock, MockMiniProgram } = vi.hoisted(() => {
  class MockMiniProgramClass {
    send = vi.fn(async () => ({ SDKVersion: '3.13.2' }))
  }
  return {
    captureDevtoolsLogBaselineMock: vi.fn(() => ({ 'devtools.log': 120 })),
    cleanupResidualDevtoolsProcessesMock: vi.fn(async () => {}),
    connectMock: vi.fn(),
    execaMock: vi.fn(),
    launchMock: vi.fn(),
    openWechatIdeProjectByHttpMock: vi.fn<(projectPath: string, options?: WechatDevtoolsHttpCommandOptions) => Promise<string>>(async () => ''),
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
    captureDevtoolsLogBaseline: captureDevtoolsLogBaselineMock,
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
  enableLog: ReturnType<typeof vi.fn>
  evaluate: ReturnType<typeof vi.fn>
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

const activeMockMiniPrograms = new Set<MockMiniProgramRuntime>()

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
  const miniProgram = {
    compile: rawCompile,
    enableLog: vi.fn(async () => {}),
    evaluate: vi.fn(async () => true),
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
  activeMockMiniPrograms.add(miniProgram)
  return miniProgram
}

async function closeActiveMockMiniPrograms() {
  const miniPrograms = Array.from(activeMockMiniPrograms)
  activeMockMiniPrograms.clear()
  const results = await Promise.allSettled(miniPrograms.map(miniProgram => miniProgram.close()))
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason)
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Failed to close mock mini-programs')
  }
}

function writeJson(target: string, value: Record<string, any>) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(value, null, 2))
}

function readJson(target: string) {
  return JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, any>
}

function createProjectFixture(projectRoot: string, appJson?: Record<string, any>, projectConfig?: Record<string, any>) {
  writeJson(path.join(projectRoot, 'project.config.json'), {
    appid: 'wxb3d842a4a7e3440d',
    miniprogramRoot: 'dist',
    ...projectConfig,
  })
  writeJson(path.join(projectRoot, 'project.private.config.json'), {
    condition: {
      miniprogram: {
        list: [],
      },
    },
  })
  if (appJson) {
    const resolvedAppJson = {
      subPackages: [],
      ...appJson,
    }
    writeJson(path.join(projectRoot, 'dist/app.json'), resolvedAppJson)

    const routes: string[] = Array.isArray(resolvedAppJson.pages)
      ? resolvedAppJson.pages.filter((page: unknown): page is string => typeof page === 'string')
      : []
    for (const subPackage of resolvedAppJson.subPackages) {
      if (!subPackage || typeof subPackage !== 'object' || typeof subPackage.root !== 'string' || !Array.isArray(subPackage.pages)) {
        continue
      }
      routes.push(...subPackage.pages
        .filter((page: unknown): page is string => typeof page === 'string')
        .map((page: string) => path.join(subPackage.root, page)))
    }
    for (const route of routes) {
      fs.mkdirSync(path.dirname(path.join(projectRoot, 'dist', `${route}.js`)), { recursive: true })
      fs.writeFileSync(path.join(projectRoot, 'dist', `${route}.js`), '')
    }
  }
}

function clearLaunchEnv() {
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD
  delete process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES
  delete process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY
  delete process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_PROJECT_REFRESH_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_TOOL_COMPILE_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT
  delete process.env.WEAPP_VITE_E2E_RELUNCH_RETRIES
  delete process.env.WEAPP_VITE_E2E_RELUNCH_RETRY_DELAY
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP
  delete process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY
  delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER
}

function readBridgePayloadFromExecaCall(index = 0) {
  const call = execaMock.mock.calls[index]
  const args = call?.[1] as string[] | undefined
  const rawPayload = args?.find(arg => arg.startsWith('{'))
  return rawPayload ? JSON.parse(rawPayload) as { projectPath?: string, timeout?: number } : undefined
}

function expectTimeoutWithinBudget(value: unknown, maximum: number) {
  expect(Number.isInteger(value)).toBe(true)
  expect(value).toBeGreaterThan(0)
  expect(value).toBeLessThanOrEqual(maximum)
  return value
}

function expectBridgeBootstrapCall(index: number, timeout: number) {
  const [command, args, options] = execaMock.mock.calls[index] ?? []
  expect(command).toBe('node')
  expect((args as string[]).slice(0, 2)).toEqual(['--import', 'tsx'])
  expect(options.reject).toBe(false)
  expect(options.gracefulCancel).toBe(true)
  expect(options.cancelSignal).toBeInstanceOf(AbortSignal)
  expect(options).not.toHaveProperty('timeout')
  expectTimeoutWithinBudget(readBridgePayloadFromExecaCall(index)?.timeout, timeout)
}

async function waitForJsonContains(target: string, expected: Record<string, any>, timeoutMs = 3_000) {
  const start = Date.now()
  let latest: Record<string, any> | undefined

  while (Date.now() - start <= timeoutMs) {
    if (fs.existsSync(target)) {
      latest = readJson(target)
      try {
        expect(latest).toMatchObject(expected)
        return latest
      }
      catch {
      }
    }
    await new Promise(resolve => setTimeout(resolve, 80))
  }

  throw new Error(`Timed out waiting for ${target} to match ${JSON.stringify(expected)}. Latest=${JSON.stringify(latest)}`)
}

function expectBridgeWrapperProjectPath(sourceProjectPath: string, projectPath: string | undefined) {
  expect(projectPath).toBeTruthy()
  expect(projectPath).not.toBe(sourceProjectPath)
  expect(projectPath).toContain(path.join('.tmp', 'e2e-ide-bridge-projects'))
  const wrapperAppJsonPath = path.join(projectPath!, 'app.json')
  expect(fs.lstatSync(wrapperAppJsonPath).isSymbolicLink()).toBe(false)
  expect(readJson(wrapperAppJsonPath)).toMatchObject({
    pages: ['pages/index/index'],
    subPackages: [],
  })
  expect(readJson(path.join(projectPath!, 'project.config.json'))).toMatchObject({
    appid: 'wxb3d842a4a7e3440d',
    miniprogramRoot: './',
    setting: {
      packNpmManually: false,
      packNpmRelationList: [],
    },
  })
}

describe('automator launch resilience', { concurrent: false }, () => {
  let sandboxRoot = ''

  beforeEach(() => {
    sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-automator-launch-'))
    const reportDir = path.join(sandboxRoot, 'report')
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_SLUG', 'automator-launch-unit')
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_DIR', reportDir)
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', path.join(reportDir, 'events.jsonl'))
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_MD_FILE', path.join(reportDir, 'index.md'))
    vi.stubEnv('WEAPP_VITE_E2E_IDE_WARNING_REPORT_JSON_FILE', path.join(reportDir, 'index.json'))
    captureDevtoolsLogBaselineMock.mockReset()
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
    captureDevtoolsLogBaselineMock.mockReturnValue({ 'devtools.log': 120 })
    scanRecentDevtoolsSimulatorBootIssuesMock.mockReturnValue([])
    clearLaunchEnv()
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'direct'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD = '0'
  })

  afterEach(async () => {
    try {
      await closeActiveMockMiniPrograms()
    }
    finally {
      clearLaunchEnv()
      vi.resetModules()
      vi.unstubAllEnvs()
      fs.rmSync(sandboxRoot, { recursive: true, force: true })
    }
  })

  it('terminates the complete CLI process tree on Windows', async () => {
    const { terminateBridgeCliProcess } = await import('../utils/automator')
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    execaMock.mockResolvedValue({ exitCode: 0 })
    try {
      await terminateBridgeCliProcess(12345)
      expect(execaMock).toHaveBeenCalledWith('taskkill', ['/PID', '12345', '/T', '/F'], {
        reject: false,
        timeout: 5_000,
        windowsHide: true,
      })
    }
    finally {
      platform.mockRestore()
    }
  })

  it('drains a canceled bootstrap before recovery and never connects its late result', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER = '0'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '1000'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const { launchAutomator } = await import('../utils/automator')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    const events: string[] = []
    let started!: () => void
    const bootstrapStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    execaMock.mockImplementation((_command, args, options) => {
      if (!args.includes('--import')) {
        events.push('recovery')
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })
      }
      if (events.includes('exit')) {
        return Promise.resolve({ exitCode: 1, stderr: 'intentional final bootstrap failure' })
      }
      expect(options.gracefulCancel).toBe(true)
      return new Promise((resolve) => {
        options.cancelSignal.addEventListener('abort', () => {
          events.push('cancel')
          setTimeout(() => {
            events.push('exit')
            resolve({ exitCode: 0, stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:43210' }) })
          }, 25)
        }, { once: true })
        started()
      })
    })
    cleanupResidualDevtoolsProcessesMock.mockImplementation(async () => {
      events.push('recovery')
    })
    try {
      const task = launchAutomator({ projectPath: sandboxRoot, timeout: 1_000, maxLaunchRetries: 2 })
      const assertion = expect(task).rejects.toThrow('intentional final bootstrap failure')
      await bootstrapStarted
      await vi.advanceTimersByTimeAsync(1_000)
      expect(events).toEqual(['cancel'])
      expect(connectMock).not.toHaveBeenCalled()
      expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2_000)
      await assertion
      expect(events.indexOf('exit')).toBeLessThan(events.indexOf('recovery'))
      expect(connectMock).not.toHaveBeenCalled()
      expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('bounds an uncooperative direct launch and closes its late session without warmup', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '1000'
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    const { launchAutomator } = await import('../utils/automator')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    let connected!: (value: MockMiniProgramRuntime) => void
    let started!: () => void
    const launchStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    launchMock.mockImplementation(() => new Promise((resolve) => {
      connected = resolve
      started()
    }))
    try {
      const result = launchAutomator({ projectPath: sandboxRoot, timeout: 1_000, maxLaunchRetries: 1, refreshProjectAfterConnect: true })
      const assertion = expect(result).rejects.toThrow(/Timeout in (?:launch automator#1|connect direct)/)
      await launchStarted
      await vi.advanceTimersByTimeAsync(1_000)
      await assertion
      connected(miniProgram)
      await vi.advanceTimersByTimeAsync(0)
      expect(miniProgram.__rawClose).toHaveBeenCalledOnce()
      expect(miniProgram.enableLog).not.toHaveBeenCalled()
      expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
      expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('stops warmup polling after launch cancellation without falling through to reLaunch', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '100'
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    const { launchAutomator } = await import('../utils/automator')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    let started!: () => void
    const warmupStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    miniProgram.__rawCurrentPage.mockImplementation(() => {
      started()
      return new Promise(() => {})
    })
    launchMock.mockResolvedValue(miniProgram)
    try {
      const result = launchAutomator({ projectPath: sandboxRoot, timeout: 100, maxLaunchRetries: 1 })
      const outcome = result.then(value => ({ value }), error => ({ error }))
      await warmupStarted
      await vi.advanceTimersByTimeAsync(100)
      expect(await outcome).toMatchObject({ error: { message: 'Timeout in launch automator#1 after 100ms' } })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(miniProgram.__rawCurrentPage).toHaveBeenCalledOnce()
      expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
      expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('closes tracked mini-programs before removing their fixture', async () => {
    const lifecycle: string[] = []
    const miniProgram = createMockMiniProgram()
    miniProgram.close.mockImplementationOnce(async () => {
      lifecycle.push('close')
    })

    await closeActiveMockMiniPrograms()
    lifecycle.push('remove')
    await closeActiveMockMiniPrograms()

    expect(lifecycle).toEqual(['close', 'remove'])
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
  })

  it('establishes the runtime log subscription before probing the real page', async () => {
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValue(miniProgram)
    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, maxLaunchRetries: 1 })
    expect(miniProgram.enableLog).toHaveBeenCalledTimes(1)
    expect(miniProgram.enableLog.mock.invocationCallOrder[0]).toBeLessThan(miniProgram.__rawCurrentPage.mock.invocationCallOrder[0]!)
  })

  it('rejects log subscription failure before warmup and closes the session', async () => {
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    miniProgram.enableLog.mockRejectedValue(new Error('App.enableLog unavailable'))
    launchMock.mockResolvedValue(miniProgram)
    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({ projectPath: sandboxRoot, maxLaunchRetries: 1 })).rejects.toThrow('App.enableLog unavailable')
    expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    const journal = fs.readFileSync(path.join(sandboxRoot, 'report/events.jsonl'), 'utf8')
    expect(journal).toContain('App.enableLog unavailable')
  })

  it('waits through cold-compile subscription timeouts in the original launch before DOM warmup', async () => {
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValue(miniProgram)
    const { launchAutomator } = await import('../utils/automator')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    try {
      let notifySubscription!: () => void
      const firstSubscription = new Promise<void>((resolve) => {
        notifySubscription = resolve
      })
      let request = 0
      miniProgram.enableLog.mockImplementation(async () => {
        request += 1
        notifySubscription()
        await new Promise(resolve => setTimeout(resolve, request < 3 ? 10_000 : 9_000))
        if (request < 3) {
          throw new Error('timeout waiting for automator response')
        }
      })
      const result = launchAutomator({ projectPath: sandboxRoot, timeout: 60_000, maxLaunchRetries: 3 })
      const assertion = expect(result).resolves.toBe(miniProgram)
      await firstSubscription
      expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(35_000)
      await assertion
      expect(launchMock).toHaveBeenCalledTimes(1)
      expect(miniProgram.enableLog).toHaveBeenCalledTimes(3)
      expect(miniProgram.enableLog.mock.invocationCallOrder[2]).toBeLessThan(miniProgram.__rawCurrentPage.mock.invocationCallOrder[0]!)
      expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
      expect(miniProgram.__rawClose).not.toHaveBeenCalled()
      expect(execaMock).not.toHaveBeenCalled()
      expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each(['monitor', 'attempt'] as const)('retains subscription diagnostics when the %s timer wins and does not relaunch', async (timer) => {
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = timer === 'monitor' ? '60000' : '16000'
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValue(miniProgram)
    const { launchAutomator } = await import('../utils/automator')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    try {
      let notifySubscription!: () => void
      const firstSubscription = new Promise<void>((resolve) => {
        notifySubscription = resolve
      })
      const lastCause = new Error('timeout waiting for automator response')
      miniProgram.enableLog
        .mockImplementationOnce(async () => {
          notifySubscription()
          await new Promise(resolve => setTimeout(resolve, 10_000))
          throw lastCause
        })
        .mockImplementation(() => new Promise<void>(() => {}))
      const result = launchAutomator({ projectPath: sandboxRoot, timeout: 16_000, maxLaunchRetries: 3 })
      const assertion = expect(result).rejects.toMatchObject({
        code: 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE',
        attempts: 2,
        lastCause,
        cause: { message: timer === 'monitor' ? 'Timeout in runtime log subscription after 16000ms' : 'Timeout in launch automator#1 after 16000ms' },
      })
      await firstSubscription
      await vi.advanceTimersByTimeAsync(16_000)
      await assertion
      await vi.advanceTimersByTimeAsync(60_000)
      expect(launchMock).toHaveBeenCalledTimes(1)
      expect(miniProgram.enableLog).toHaveBeenCalledTimes(2)
      expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
      expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
      expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
      expect(execaMock).not.toHaveBeenCalled()
      expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each(['compile failed: SyntaxError', 'Connection closed, check if wechat web devTools is still running'])('preserves subscription failure %s without converting it to deadline or relaunching', async (message) => {
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })
    const miniProgram = createMockMiniProgram()
    const failure = new Error(message)
    miniProgram.enableLog.mockRejectedValue(failure)
    launchMock.mockResolvedValue(miniProgram)
    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({ projectPath: sandboxRoot, maxLaunchRetries: 3 })).rejects.toBe(failure)
    expect(launchMock).toHaveBeenCalledTimes(1)
    expect(miniProgram.enableLog).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalled()
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
  })

  it('extracts DevTools service port from cli bridge output', async () => {
    const { extractWechatDevtoolsServicePort } = await import('../utils/automator.cli-bridge')

    expect(extractWechatDevtoolsServicePort('IDE server started successfully, listening on http://127.0.0.1:33372')).toBe(33372)
    expect(extractWechatDevtoolsServicePort('✔ IDE server has started, listening on http://127.0.0.1:50007')).toBe(50007)
    expect(extractWechatDevtoolsServicePort('IDE server started without a port')).toBeUndefined()
  })

  it('treats DevTools islogin stale port output as unknown login state in bridge mode', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: '- initialize\n\n✖ IDE may already started at port 11007, trying to connect',
    })

    const { assertDevtoolsLoggedIn } = await import('../utils/automator')
    await expect(assertDevtoolsLoggedIn(sandboxRoot)).resolves.toBeUndefined()

    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['islogin'], expect.objectContaining({
      reject: false,
      timeout: 30_000,
    }))
    expect(launchMock).not.toHaveBeenCalled()
  })

  it('confirms a transient logged-out result before failing login preflight', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    execaMock
      .mockResolvedValueOnce({ exitCode: 0, stdout: '{"login":false}', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '{"login":true}', stderr: '' })

    const { assertDevtoolsLoggedIn } = await import('../utils/automator')
    await expect(assertDevtoolsLoggedIn(sandboxRoot)).resolves.toBeUndefined()

    expect(execaMock).toHaveBeenCalledTimes(2)
    expect(launchMock).not.toHaveBeenCalled()
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

  it('retries launch when DevTools cli exits before the automator socket is ready', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const secondMiniProgram = createMockMiniProgram()
    launchMock
      .mockRejectedValueOnce(new Error('Failed to launch wechat web devTools, please make sure cliPath is correctly specified'))
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, warmupAllowRelaunch: false })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('retries launch when post-connect DevTools http reset closes the socket', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const firstMiniProgram = createMockMiniProgram()
    const secondMiniProgram = createMockMiniProgram()
    resetWechatIdeFileUtilsByHttpMock
      .mockRejectedValueOnce(new TypeError('fetch failed', {
        cause: new Error('other side closed'),
      }))
      .mockResolvedValueOnce('')
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, warmupAllowRelaunch: false })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.anything())
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
  })

  it('retries launch when the post-connect project refresh times out', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_PROJECT_REFRESH_TIMEOUT = '20'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const firstMiniProgram = createMockMiniProgram()
    const secondMiniProgram = createMockMiniProgram()
    const events: string[] = []
    openWechatIdeProjectByHttpMock.mockImplementationOnce((_projectPath, options) => new Promise<string>((_resolve, reject) => {
      const signal = options?.signal
      if (!signal) {
        throw new Error('Project refresh must receive a cancellation signal')
      }
      signal.addEventListener('abort', () => {
        events.push('abort-request')
        setTimeout(() => {
          events.push('request-settled')
          reject(signal.reason)
        }, 5)
      }, { once: true })
    }))
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockImplementationOnce(async () => {
        events.push('retry-launch')
        return secondMiniProgram
      })

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, warmupAllowRelaunch: false })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledTimes(2)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenNthCalledWith(1, sandboxRoot, {
      timeoutMs: 20,
      signal: expect.any(AbortSignal),
    })
    expect(events).toEqual(['abort-request', 'request-settled', 'retry-launch'])
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
  })

  it('retries launch when the DevTools project refresh HTTP request times out', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_PROJECT_REFRESH_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const firstMiniProgram = createMockMiniProgram()
    const secondMiniProgram = createMockMiniProgram()
    openWechatIdeProjectByHttpMock.mockRejectedValueOnce(new Error('WECHAT_DEVTOOLS_HTTP_TIMEOUT'))
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, warmupAllowRelaunch: false })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledTimes(2)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
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

  it('does not launch DevTools when app.json is missing subPackages', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '40'

    createProjectFixture(sandboxRoot)
    writeJson(path.join(sandboxRoot, 'dist/app.json'), {
      pages: ['pages/index/index'],
    })

    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({ projectPath: sandboxRoot })).rejects.toMatchObject({
      name: 'WechatIdeLaunchAppConfigNotReadyError',
      message: expect.stringContaining('reason=subPackages is missing'),
    })

    expect(launchMock).not.toHaveBeenCalled()
    expect(connectMock).not.toHaveBeenCalled()
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
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
    await launchAutomator({ projectPath: sandboxRoot, warmupAllowRelaunch: false })

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

  it('retries launch when recent DevTools logs include simulator boot errors', async () => {
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

  it('aborts direct connect when DevTools logs simulator boot errors before launch resolves', async () => {
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
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
    scanRecentDevtoolsSimulatorBootIssuesMock
      .mockReturnValueOnce([{
        file: 'devtools.log',
        line: '[ERROR] simulator launch catch error TypeError: Cannot read property \'subPackages\' of undefined',
      }])
      .mockReturnValue([])

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000, warmupAllowRelaunch: false })

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(execaMock).toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(secondMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
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
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000, warmupAllowRelaunch: false })

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

  it('accepts warmup reLaunch stale page handle when current page is rendered', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const stalePage = createMockPage('/pages/index/index')
    stalePage.$ = vi.fn(async () => null)
    stalePage.$$ = vi.fn(async () => [])
    const currentPage = createMockPage('/pages/index/index')
    const miniProgram = createMockMiniProgram()
    let relaunched = false
    miniProgram.currentPage = miniProgram.__rawCurrentPage = vi.fn()
      .mockImplementation(async () => relaunched ? currentPage : createMockPage('/pages/other/index'))
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => {
      relaunched = true
      return stalePage
    })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({ projectPath: sandboxRoot, timeout: 3_000 })).resolves.toBeTruthy()

    expect(launchMock).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
    expect(stalePage.$$).toHaveBeenCalled()
    expect(currentPage.$$).toHaveBeenCalledWith('page')
    expect(miniProgram.__rawClose).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.anything())
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
  })

  it('rejects warmup timeout when target page root is unavailable but route is current', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const page = createMockPage('/pages/index/index')
    page.$ = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 80))
      return null
    })
    page.$$ = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 80))
      return []
    })
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
    await expect(launchAutomator({
      projectPath: sandboxRoot,
      timeout: 3_000,
      warmupAllowRelaunch: true,
    })).rejects.toThrow('Timeout in warmup reLaunch /pages/index/index')

    expect(launchMock).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawReLaunch).toHaveBeenCalledWith('/pages/index/index')
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(execaMock).not.toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.anything())
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
  })

  it('retries warmup relaunch timeouts only when explicitly enabled', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT = '3000'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const firstPage = createMockPage('/pages/index/index')
    const firstMiniProgram = createMockMiniProgram({
      currentPage: createMockPage('/pages/other/index'),
    })
    firstMiniProgram.reLaunch = firstMiniProgram.__rawReLaunch = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 80))
      return firstPage
    })
    const secondMiniProgram = createMockMiniProgram({
      currentPage: createMockPage('/pages/index/index'),
    })
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({
      projectPath: sandboxRoot,
      retryWarmupTimeout: true,
      timeout: 3_000,
    })).resolves.toBeTruthy()

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(execaMock).toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['cache', '--clean', 'compile'],
      expect.objectContaining({
        reject: false,
        timeout: 20_000,
      }),
    )
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
  })

  it('retries launch when an explicit warmup root selector is unavailable', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES = '2'
    process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY = '1'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const missingRootPage = createMockPage('/pages/index/index')
    missingRootPage.$ = vi.fn(async (selector: string) => selector === '#ready-root' ? null : { tag: 'generic-root' })
    missingRootPage.$$ = vi.fn(async (selector: string) => selector === '#ready-root' ? [] : [{ tag: 'generic-root' }])
    const firstMiniProgram = createMockMiniProgram({ currentPage: missingRootPage })
    firstMiniProgram.reLaunch = firstMiniProgram.__rawReLaunch = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 80))
      return missingRootPage
    })
    const secondMiniProgram = createMockMiniProgram({ currentPage: createMockPage('/pages/index/index') })
    launchMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })

    const { launchAutomator } = await import('../utils/automator')
    await expect(launchAutomator({
      projectPath: sandboxRoot,
      retryWarmupTimeout: true,
      timeout: 3_000,
      warmupRootSelectors: ['#ready-root'],
    })).resolves.toBeTruthy()

    expect(launchMock).toHaveBeenCalledTimes(2)
    expect(firstMiniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(cleanupResidualDevtoolsProcessesMock).toHaveBeenCalledTimes(1)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledTimes(1)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledWith(sandboxRoot, {
      timeoutMs: expectTimeoutWithinBudget(openWechatIdeProjectByHttpMock.mock.calls[0]?.[1]?.timeoutMs, 24_000),
      signal: expect.any(AbortSignal),
    })
    expect(resetWechatIdeFileUtilsByHttpMock).toHaveBeenCalledTimes(1)
    expect(runWechatIdeEngineBuildByHttpMock).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCompile).toHaveBeenCalledTimes(1)
    expect(secondMiniProgram.__rawCurrentPage).toHaveBeenCalled()
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
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000, warmupAllowRelaunch: false })

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
    await launchAutomator({ projectPath: sandboxRoot, timeout: 3_000, warmupAllowRelaunch: false })

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
    expect(execaMock).not.toHaveBeenCalledWith(DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.anything())
    expect(cleanupResidualDevtoolsProcessesMock).not.toHaveBeenCalled()
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
        killDescendants: true,
      }),
    )
    expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('continues when cli engine build opens project but exits non-zero', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH = '1'
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    try {
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
      await launchAutomator({
        engineBuildFallbackSettleMs: 0,
        projectPath: sandboxRoot,
      })

      expect(execaMock).toHaveBeenCalledWith(
        DEFAULT_WECHAT_CLI_PATH,
        ['engine', 'build', sandboxRoot],
        expect.objectContaining({
          reject: false,
          timeout: 70_000,
          killDescendants: true,
        }),
      )
      expect(runWechatIdeEngineBuildByHttpMock).toHaveBeenCalledTimes(2)
      expect(stdoutWriteSpy.mock.calls.some(([message]) => String(message).includes('source=http-after-cli-open'))).toBe(true)
      expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
      expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
      expect(miniProgram.__rawReLaunch).not.toHaveBeenCalled()
    }
    finally {
      stdoutWriteSpy.mockRestore()
    }
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

  it('refreshes the opened devtools project before fileutils reset when the launch option enables it', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({
      projectPath: sandboxRoot,
      refreshProjectAfterConnect: true,
    })

    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledWith(sandboxRoot, {
      timeoutMs: 60_000,
      signal: expect.any(AbortSignal),
    })
    expect(openWechatIdeProjectByHttpMock.mock.invocationCallOrder[0]).toBeLessThan(
      resetWechatIdeFileUtilsByHttpMock.mock.invocationCallOrder[0]!,
    )
    expect(resetWechatIdeFileUtilsByHttpMock.mock.invocationCallOrder[0]).toBeLessThan(
      miniProgram.__rawCurrentPage.mock.invocationCallOrder[0]!,
    )
  })

  it('retains startup and compile errors across post-connect refresh until session close', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    createProjectFixture(sandboxRoot, { pages: ['pages/index/index'] })

    const miniProgram = createMockMiniProgram()
    const emit = (event: string, entry: unknown) => {
      const listener = miniProgram.on.mock.calls.find(([name]) => name === event)?.[1] as ((entry: unknown) => void) | undefined
      expect(listener).toEqual(expect.any(Function))
      listener!(entry)
    }
    miniProgram.enableLog.mockImplementationOnce(async () => {
      emit('console', { type: 'error', args: ['startup before refresh failed'] })
    })
    openWechatIdeProjectByHttpMock.mockImplementationOnce(async () => {
      emit('console', { type: 'error', args: ['project refresh failed'] })
      return ''
    })
    miniProgram.compile.mockImplementationOnce(async () => {
      emit('exception', { exceptionDetails: { text: 'compile runtime exception' } })
    })
    launchMock.mockResolvedValueOnce(miniProgram)
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const { launchAutomator } = await import('../utils/automator')
      const launched = await launchAutomator({
        projectPath: sandboxRoot,
        refreshProjectAfterConnect: true,
      })

      expect(miniProgram.__rawCompile).toHaveBeenCalledWith({ force: true })
      expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
      expect(launched.__weappViteRuntimeLogMeta.entries).toEqual([
        { level: 'error', text: 'startup before refresh failed' },
        { level: 'error', text: 'project refresh failed' },
        { level: 'exception', text: 'compile runtime exception' },
      ])
      expect(launched.__weappViteRuntimeLogMeta.stats).toMatchObject({ error: 2, exception: 1, total: 3 })
      await launched.close()
      const output = stderrWrite.mock.calls.map(([text]) => String(text)).join('')
      expect(output).toContain('error=2 exception=1 total=3')
      expect(output).toContain('[error] [runtime] startup before refresh failed')
      expect(output).toContain('[error] [runtime] project refresh failed')
      expect(output).toContain('[error] [runtime:exception] compile runtime exception')
    }
    finally {
      stderrWrite.mockRestore()
    }
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
    expect(miniProgram.__rawReLaunch).toHaveBeenCalledWith('/subpackages/lab/class-binding/index')
  })

  it('prebuilds project index before direct DevTools launch when explicitly enabled', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD = '1'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const miniProgram = createMockMiniProgram()
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot })

    expect(execaMock).toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.objectContaining({
        reject: false,
        timeout: 70_000,
        killDescendants: true,
        cancelSignal: expect.any(AbortSignal),
      }),
    )
    expect(execaMock.mock.invocationCallOrder[0]).toBeLessThan(launchMock.mock.invocationCallOrder[0]!)
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalled()
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
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345, warmupAllowRelaunch: false })

    expect(launchMock).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledTimes(1)
    expectBridgeWrapperProjectPath(sandboxRoot, readBridgePayloadFromExecaCall()?.projectPath)
    expect(connectMock).toHaveBeenCalledWith({
      timeout: 4_000,
      wsEndpoint: 'ws://127.0.0.1:9420',
    })
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
    expect(connectedMiniProgram.waitForAppReady).toBeUndefined()
  })

  it('launches the complete snapshot without changing roots or clearing startup evidence', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
      window: {
        navigationBarTitleText: 'real app',
      },
    }, {
      setting: {
        es6: true,
        postcss: true,
      },
      simulatorType: 'wechat',
    })

    const connectedMiniProgram = createMockMiniProgram({
      currentPage: createMockPage(),
    })
    let wrapperProjectPath = ''
    let initialConfig = ''
    let initialConfigMtime = 0
    connectedMiniProgram.enableLog.mockImplementationOnce(async () => {
      const consoleListener = connectedMiniProgram.on.mock.calls.find(([event]) => event === 'console')?.[1] as (entry: unknown) => void
      consoleListener({ type: 'info', args: ['snapshot startup evidence'] })
    })
    execaMock.mockImplementationOnce(async (_command, args: string[]) => {
      const rawPayload = args.find(arg => arg.startsWith('{'))
      const payload = JSON.parse(rawPayload!) as { projectPath: string }
      wrapperProjectPath = payload.projectPath
      const configPath = path.join(wrapperProjectPath, 'project.config.json')
      initialConfig = fs.readFileSync(configPath, 'utf8')
      initialConfigMtime = fs.statSync(configPath).mtimeMs
      expect(readJson(path.join(wrapperProjectPath, 'project.config.json'))).toMatchObject({
        miniprogramRoot: './',
        setting: {
          es6: true,
          packNpmManually: false,
          packNpmRelationList: [],
          postcss: true,
        },
      })
      expect(readJson(path.join(wrapperProjectPath, 'project.config.json'))).toMatchObject({ simulatorType: 'wechat' })
      expect(readJson(path.join(wrapperProjectPath, 'app.json'))).toEqual({
        pages: ['pages/index/index'],
        subPackages: [],
        window: { navigationBarTitleText: 'real app' },
      })
      expect(readJson(path.join(wrapperProjectPath, 'project.private.config.json'))).toMatchObject({
        condition: {
          miniprogram: {
            list: [],
          },
        },
      })
      return {
        exitCode: 0,
        stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
        stderr: '',
      }
    })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)
    const copyFileSyncSpy = vi.spyOn(fs, 'copyFileSync')

    const { launchAutomator } = await import('../utils/automator')
    const launchedMiniProgram = await launchAutomator({
      projectPath: sandboxRoot,
      refreshProjectAfterConnect: false,
      timeout: 12_345,
      warmupAllowRelaunch: false,
    })

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
    expect(connectedMiniProgram.evaluate).not.toHaveBeenCalled()
    expect(launchedMiniProgram.__weappViteRuntimeLogMeta.entries).toEqual([
      { level: 'info', text: 'snapshot startup evidence' },
    ])
    expect(fs.readFileSync(path.join(wrapperProjectPath, 'project.config.json'), 'utf8')).toBe(initialConfig)
    expect(fs.statSync(path.join(wrapperProjectPath, 'project.config.json')).mtimeMs).toBe(initialConfigMtime)
    expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(connectedMiniProgram.__rawCompile).not.toHaveBeenCalled()
    const realAppConfigCopy = copyFileSyncSpy.mock.calls.findIndex(([, target]) => {
      return target === path.join(wrapperProjectPath, 'app.json')
    })
    expect(realAppConfigCopy).toBeGreaterThanOrEqual(0)
    expect(copyFileSyncSpy.mock.invocationCallOrder[realAppConfigCopy]).toBeLessThan(execaMock.mock.invocationCallOrder[0]!)
  })

  it('keeps compileType plugin projects on their original roots in bridge mode', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    }, {
      compileType: 'plugin',
      pluginRoot: 'dist-plugin',
    })
    writeJson(path.join(sandboxRoot, 'dist-plugin/plugin.json'), {
      publicComponents: {},
    })

    const connectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage() })
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9420' }),
      stderr: '',
    })
    connectMock.mockResolvedValueOnce(connectedMiniProgram)

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345, warmupAllowRelaunch: false })

    const payload = readBridgePayloadFromExecaCall()
    expect(payload?.projectPath).toBe(sandboxRoot)
    expect(readJson(path.join(payload!.projectPath!, 'project.config.json'))).toMatchObject({
      compileType: 'plugin',
      miniprogramRoot: 'dist',
      pluginRoot: 'dist-plugin',
    })
    expect(readJson(path.join(payload!.projectPath!, 'dist-plugin/plugin.json'))).toMatchObject({
      publicComponents: {},
    })
    expect(connectMock).toHaveBeenCalledWith({
      timeout: 4_000,
      wsEndpoint: 'ws://127.0.0.1:9420',
    })
  })

  it('keeps cli bridge wrapper dist files synced with the real project dist', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'
    const rmSyncSpy = vi.spyOn(fs, 'rmSync')

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
    const launchedMiniProgram = await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    const wrapperProjectPath = readBridgePayloadFromExecaCall()?.projectPath
    expectBridgeWrapperProjectPath(sandboxRoot, wrapperProjectPath)
    expect(rmSyncSpy.mock.calls.some(([target]) => String(target) === path.join(wrapperProjectPath!, 'pages'))).toBe(false)

    const wrapperAppJsonPath = path.join(wrapperProjectPath!, 'app.json')
    const initialWrapperAppJsonMtime = fs.statSync(wrapperAppJsonPath).mtimeMs
    await new Promise(resolve => setTimeout(resolve, 2_200))
    expect(fs.statSync(wrapperAppJsonPath).mtimeMs).toBe(initialWrapperAppJsonMtime)

    writeJson(path.join(sandboxRoot, 'dist/app.json'), {
      pages: ['pages/index/index', 'pages/hmr/index'],
      subPackages: [],
      window: {
        navigationBarTitleText: 'hmr synced',
      },
    })

    await waitForJsonContains(path.join(wrapperProjectPath!, 'app.json'), {
      pages: ['pages/index/index', 'pages/hmr/index'],
      window: {
        navigationBarTitleText: 'hmr synced',
      },
    })

    const nestedDistFile = path.join(sandboxRoot, 'dist/pages/hmr/index.wxml')
    fs.mkdirSync(path.dirname(nestedDistFile), { recursive: true })
    fs.writeFileSync(nestedDistFile, '<view>nested hmr synced</view>', 'utf8')
    await waitForJsonContains(path.join(wrapperProjectPath!, 'app.json'), {
      pages: ['pages/index/index', 'pages/hmr/index'],
    })
    await vi.waitFor(() => {
      expect(fs.readFileSync(path.join(wrapperProjectPath!, 'pages/hmr/index.wxml'), 'utf8')).toContain('nested hmr synced')
    })

    fs.rmSync(nestedDistFile, { force: true })
    await vi.waitFor(() => {
      expect(fs.existsSync(path.join(wrapperProjectPath!, 'pages/hmr/index.wxml'))).toBe(false)
    })

    fs.rmSync(path.join(sandboxRoot, 'dist'), { recursive: true, force: true })
    fs.mkdirSync(path.join(sandboxRoot, 'dist/pages/rebuilt'), { recursive: true })
    writeJson(path.join(sandboxRoot, 'dist/app.json'), {
      pages: ['pages/rebuilt/index'],
      subPackages: [],
    })
    fs.writeFileSync(
      path.join(sandboxRoot, 'dist/pages/rebuilt/index.wxml'),
      '<view>rebuilt dist hmr synced</view>',
      'utf8',
    )
    await waitForJsonContains(path.join(wrapperProjectPath!, 'app.json'), {
      pages: ['pages/rebuilt/index'],
    })
    await vi.waitFor(() => {
      expect(fs.readFileSync(path.join(wrapperProjectPath!, 'pages/rebuilt/index.wxml'), 'utf8')).toContain('rebuilt dist hmr synced')
    })
    await launchedMiniProgram.disconnect?.()

    const sourceAppJsonPath = path.join(sandboxRoot, 'dist/app.json')
    const staleWrapperContent = fs.readFileSync(wrapperAppJsonPath, 'utf8')
    const sameSizeAppJson = staleWrapperContent.replace('pages/rebuilt/index', 'pages/changed/index')
    expect(sameSizeAppJson.length).toBe(staleWrapperContent.length)
    fs.writeFileSync(sourceAppJsonPath, sameSizeAppJson, 'utf8')
    fs.mkdirSync(path.join(sandboxRoot, 'dist/pages/changed'), { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'dist/pages/changed/index.js'), '')
    const sourceAppJsonStat = fs.statSync(sourceAppJsonPath)
    fs.utimesSync(
      wrapperAppJsonPath,
      sourceAppJsonStat.atime,
      new Date(sourceAppJsonStat.mtimeMs + 5_000),
    )

    const reconnectedMiniProgram = createMockMiniProgram({ currentPage: createMockPage('pages/changed/index') })
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9421' }),
      stderr: '',
    })
    connectMock.mockResolvedValueOnce(reconnectedMiniProgram)

    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })
    const reconnectedWrapperProjectPath = readBridgePayloadFromExecaCall(1)?.projectPath
    expect(reconnectedWrapperProjectPath).not.toBe(wrapperProjectPath)
    expect(readJson(path.join(reconnectedWrapperProjectPath!, 'app.json'))).toMatchObject({
      pages: ['pages/changed/index'],
    })
    await reconnectedMiniProgram.disconnect?.()
  })

  it('can disable cli bridge wrapper project for focused launch debugging', async () => {
    process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'bridge'
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY = '1'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD = '0'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER = '0'

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

    expect(readBridgePayloadFromExecaCall()?.projectPath).toBe(sandboxRoot)
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
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
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345, warmupAllowRelaunch: false })

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
      warmupAllowRelaunch: false,
      warmupAnyPage: true,
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

    const prebuildProjectPath = execaMock.mock.calls[0]?.[1]?.[2] as string | undefined
    expectBridgeWrapperProjectPath(sandboxRoot, prebuildProjectPath)
    expect(execaMock).toHaveBeenNthCalledWith(
      1,
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', prebuildProjectPath],
      expect.objectContaining({
        reject: false,
        timeout: expectTimeoutWithinBudget(execaMock.mock.calls[0]?.[2]?.timeout, 24_000),
        cancelSignal: expect.any(AbortSignal),
        killDescendants: true,
      }),
    )
    expectBridgeBootstrapCall(1, 12_345)
    expect(execaMock).toHaveBeenCalledTimes(2)
    expect(execaMock.mock.calls[0]?.[2]?.cancelSignal).toBe(execaMock.mock.calls[1]?.[2]?.cancelSignal)
    expect(connectMock).toHaveBeenCalledWith({
      timeout: 4_000,
      wsEndpoint: 'ws://127.0.0.1:9420',
    })
    expect(connectedMiniProgram.__rawCurrentPage).toHaveBeenCalled()
    expect(connectedMiniProgram.__rawReLaunch).not.toHaveBeenCalled()
  })

  it('does not wait for an emitted warmup bundle when cli bridge launch skips prebuild', async () => {
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
    expectBridgeBootstrapCall(0, 12_345)
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
    connectMock
      .mockResolvedValueOnce(firstMiniProgram)
      .mockResolvedValueOnce(secondMiniProgram)
    resetWechatIdeFileUtilsByHttpMock
      .mockRejectedValueOnce(fetchError)
      .mockResolvedValue('')
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

    const { launchAutomator } = await import('../utils/automator')
    await launchAutomator({ projectPath: sandboxRoot, timeout: 12_345 })

    const firstWrapperProjectPath = (readBridgePayloadFromExecaCall()?.projectPath)
    expect(connectMock).toHaveBeenCalledTimes(2)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledTimes(2)
    expect(openWechatIdeProjectByHttpMock).toHaveBeenNthCalledWith(1, firstWrapperProjectPath, {
      timeoutMs: expectTimeoutWithinBudget(openWechatIdeProjectByHttpMock.mock.calls[0]?.[1]?.timeoutMs, 24_000),
      signal: expect.any(AbortSignal),
    })
    expect(openWechatIdeProjectByHttpMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(path.join('.tmp', 'e2e-ide-bridge-projects')),
      {
        timeoutMs: expectTimeoutWithinBudget(openWechatIdeProjectByHttpMock.mock.calls[1]?.[1]?.timeoutMs, 24_000),
        signal: expect.any(AbortSignal),
      },
    )
    expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalledWith(sandboxRoot)
    expect(resetWechatIdeFileUtilsByHttpMock).toHaveBeenCalledTimes(2)
    expect(execaMock).not.toHaveBeenCalledWith(
      DEFAULT_WECHAT_CLI_PATH,
      ['engine', 'build', sandboxRoot],
      expect.anything(),
    )
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

    expectBridgeBootstrapCall(0, 12_345)
    expect(execaMock).toHaveBeenNthCalledWith(2, DEFAULT_WECHAT_CLI_PATH, ['cache', '--clean', 'compile'], expect.objectContaining({
      reject: false,
      timeout: 20_000,
    }))
    expectBridgeBootstrapCall(2, 12_345)
    expect(connectMock).toHaveBeenCalledWith({
      timeout: 4_000,
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
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawClose).toHaveBeenCalledTimes(1)
    expect(resetWechatIdeFileUtilsByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(miniProgram.__rawCompile).not.toHaveBeenCalled()
  })

  it('keeps the current runtime session when raw relaunch times out after reaching target page', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'
    process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT = '20'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const currentPage = createMockPage('pages/index/index')
    const miniProgram = createMockMiniProgram({ currentPage })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 80))
      return createMockPage()
    })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launched = await launchAutomator({ projectPath: sandboxRoot })

    await expect(launched.reLaunch('/pages/index/index')).resolves.toBe(currentPage)

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalledTimes(1)
    expect(currentPage.$$.mock.calls.length + currentPage.$.mock.calls.length).toBeGreaterThan(0)
    expect(miniProgram.__rawClose).not.toHaveBeenCalled()
  })

  it('uses the current page when DevTools reports an automator response timeout after relaunch', async () => {
    process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT = '400'
    process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'

    createProjectFixture(sandboxRoot, {
      pages: ['pages/index/index'],
    })

    const currentPage = createMockPage('pages/index/index')
    const miniProgram = createMockMiniProgram({ currentPage })
    miniProgram.reLaunch = miniProgram.__rawReLaunch = vi.fn(async () => {
      throw new Error('timeout waiting for automator response')
    })
    launchMock.mockResolvedValueOnce(miniProgram)

    const { launchAutomator } = await import('../utils/automator')
    const launched = await launchAutomator({ projectPath: sandboxRoot })

    await expect(launched.reLaunch('/pages/index/index')).resolves.toBe(currentPage)

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawCurrentPage).toHaveBeenCalledTimes(1)
    expect(miniProgram.__rawClose).not.toHaveBeenCalled()
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

    await expect(launched.reLaunch('/pages/index/index')).resolves.toBe(page)

    expect(miniProgram.__rawReLaunch).toHaveBeenCalledTimes(1)
    expect(page.$).toHaveBeenCalled()
    expect(miniProgram.__rawCurrentPage).not.toHaveBeenCalled()
    expect(miniProgram.__rawClose).not.toHaveBeenCalled()
    expect(resetWechatIdeFileUtilsByHttpMock).not.toHaveBeenCalled()
    expect(runWechatIdeEngineBuildByHttpMock).not.toHaveBeenCalled()
    expect(miniProgram.__rawCompile).not.toHaveBeenCalled()
  })
})
