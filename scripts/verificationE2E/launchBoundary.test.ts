import net from 'node:net'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resource: vi.fn(() => {
    throw new Error('Invalid provider must not enter runtime resources')
  }),
}))

// 保留真实 launchAutomator 和 provider 解析，隔离所有启动、宿主与文件监听入口。
vi.mock('@weapp-vite/miniprogram-automator', () => ({
  Automator: class {
    launch = mocks.resource
    connect = mocks.resource
  },
  isRecoverableOperationError: mocks.resource,
}))
vi.mock('execa', () => ({ execa: mocks.resource }))
vi.mock('../../packages/weapp-ide-cli/src/cli/engine', () => ({ runWechatIdeEngineBuildByHttp: mocks.resource }))
vi.mock('../../packages/weapp-ide-cli/src/cli/http', () => ({
  openWechatIdeProjectByHttp: mocks.resource,
  resetWechatIdeFileUtilsByHttp: mocks.resource,
}))
vi.mock('../../packages/weapp-ide-cli/src/cli/managedProjectGate', () => ({ ensureManagedWechatProject: mocks.resource }))
vi.mock('../../packages/weapp-ide-cli/src/cli/projectImport', () => ({ importManagedDevtoolsProject: mocks.resource }))
vi.mock('../../packages/weapp-ide-cli/src/cli/wechatDevtoolsRuntimePort', () => ({
  getRuntimeWechatDevtoolsServicePort: mocks.resource,
  setRuntimeWechatDevtoolsServicePort: mocks.resource,
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async (importOriginal) => {
  const { MANAGED_PROJECT_JOURNAL_ENV } = await importOriginal<typeof import('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>()
  return {
    MANAGED_PROJECT_JOURNAL_ENV,
    cleanupManagedWechatProjects: mocks.resource,
    closeManagedWechatProject: mocks.resource,
  }
})
vi.mock('../../e2e/ide/runtimeErrors', () => ({ normalizeRuntimeConsoleText: mocks.resource }))
vi.mock('../../e2e/utils/automator.cli-bridge', () => ({ extractWechatDevtoolsServicePort: mocks.resource }))
vi.mock('../../e2e/utils/automator.headless', () => ({ launchHeadlessAutomator: mocks.resource }))
vi.mock('../../e2e/utils/automatorBootLogMonitor', () => ({
  createDevtoolsSimulatorBootLogMonitor: mocks.resource,
  DEVTOOLS_LOG_SCAN_INTERVAL: 100,
  DevtoolsSimulatorBootLogError: class extends Error {},
}))
vi.mock('../../e2e/utils/automatorBridgeCleanup', () => ({
  attachBridgeWrapperSyncCleanup: mocks.resource,
  cleanupFailedBridgeLaunch: mocks.resource,
  createRetryableCleanup: mocks.resource,
}))
vi.mock('../../e2e/utils/automatorBridgeFiles', () => ({
  copyDistEntryForBridgeWrapper: mocks.resource,
  safeReadDirectory: mocks.resource,
  safeStat: mocks.resource,
}))
vi.mock('../../e2e/utils/automatorLaunchLifecycle', () => ({ AutomatorLaunchLifecycle: mocks.resource }))
vi.mock('../../e2e/utils/automatorReconnect', () => ({
  reconnectAutomator: mocks.resource,
  registerAutomatorReconnect: mocks.resource,
}))
vi.mock('../../e2e/utils/devtoolsCli', () => ({ resolveWechatCliPath: mocks.resource }))
vi.mock('../../e2e/utils/devtoolsProcessOwnership', () => ({
  createDevtoolsProjectJournal: mocks.resource,
  ownDevtoolsCleanup: mocks.resource,
}))
vi.mock('../../e2e/utils/devtoolsSelection', () => ({
  assertSelectedWechatDevtoolsRuntime: mocks.resource,
  resolveSelectedWechatDevtools: mocks.resource,
}))
vi.mock('../../e2e/utils/ide-devtools-cleanup', () => ({ cleanupResidualDevtoolsProcesses: mocks.resource }))
vi.mock('../../e2e/utils/ideWarningReport', () => ({
  appendIdeReportEvent: mocks.resource,
  resolveReportProjectPath: mocks.resource,
}))
vi.mock('../../e2e/utils/managedProjectSession', () => ({ attachManagedProjectSession: mocks.resource }))
vi.mock('../../e2e/utils/runtimeConsoleSessions', () => ({ registerRuntimeConsoleSession: mocks.resource }))
vi.mock('../../e2e/utils/runtimeLogSubscription', () => ({ createRuntimeLogSubscription: mocks.resource }))
vi.mock('../../e2e/utils/startupProtocolDiagnostics', () => ({ createStartupProtocolDiagnostics: mocks.resource }))
vi.mock('../../e2e/utils/watchResolvedDirectory', () => ({ watchResolvedDirectory: mocks.resource }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it('throws invalid provider configuration synchronously before entering runtime resources', async () => {
  vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'invalid-provider')
  vi.stubEnv('WEAPP_VITE_E2E_TIMING_FILE', undefined)
  const originalListen = net.Server.prototype.listen
  const { launchAutomator } = await import('../../e2e/utils/automator')
  expect(mocks.resource).not.toHaveBeenCalled()

  let result: ReturnType<typeof launchAutomator> | undefined
  let failure: unknown
  try {
    result = launchAutomator({ projectPath: 'e2e-apps/launch-boundary-fixture' })
  }
  catch (error) {
    failure = error
  }
  // 回归为 rejected Promise 时先接住它，避免用未处理拒绝代替同步契约断言。
  await result?.catch(() => {})
  expect(result).toBeUndefined()
  expect(failure).toBeInstanceOf(Error)
  expect((failure as Error).message).toContain('Unsupported e2e runtime provider "invalid-provider"')
  expect(mocks.resource).not.toHaveBeenCalled()
  expect(net.Server.prototype.listen).toBe(originalListen)
})
