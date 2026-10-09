import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { launchManagedAutomator } from './managed'

const mocks = vi.hoisted(() => ({
  assertPort: vi.fn(async () => {}),
  begin: vi.fn(),
  importProject: vi.fn(async () => {}),
  lease: vi.fn(),
  persist: vi.fn(async () => {}),
  release: vi.fn(async () => {}),
  start: vi.fn(),
}))

vi.mock('@weapp-vite/miniprogram-automator', () => ({ acquireAutomatorPortLease: mocks.lease }))
vi.mock('../../devtoolsProjectOwnership', () => ({ beginManagedWechatProject: mocks.begin }))
vi.mock('../../devtoolsTarget', () => ({ assertWechatDevtoolsPort: mocks.assertPort }))
vi.mock('../agentStart', () => ({ startWechatIdeAgent: mocks.start }))
vi.mock('../projectImport', () => ({ importManagedDevtoolsProject: mocks.importProject }))
vi.mock('./sessionStore', () => ({ persistAutomatorSession: mocks.persist }))

const target = {
  appPath: 'selected-app',
  channel: 'stable' as const,
  cliPath: 'selected-cli',
  installationId: 'selected-installation',
  profileDir: 'selected-profile',
  version: 'selected-version',
}
const options = {
  projectPath: '/repo/project',
  sourceProjectPath: '/repo/source-project',
  port: 58_802,
  trustProject: true,
}

function createScope(): any {
  return {
    own: vi.fn(() => vi.fn()),
    remainingMs: vi.fn(() => 10_000),
    signal: new AbortController().signal,
    step: vi.fn(async <T>(run: () => Promise<T>) => await run()),
    throwIfAborted: vi.fn(),
  }
}

function createOwner() {
  return {
    close: vi.fn(async () => {}),
    confirm: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    id: 'project-owner',
    journalPath: '/repo/journal',
  }
}

function createProgram() {
  return {
    disconnect: vi.fn(),
    waitForAppReady: vi.fn(async () => {}),
  } as unknown as MiniProgram
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.lease.mockResolvedValue({ port: options.port, release: mocks.release })
  mocks.begin.mockResolvedValue(createOwner())
  mocks.start.mockImplementation(async ({ onStarted }: { onStarted: (result: unknown) => Promise<void> }) => {
    await onStarted({ autoPort: options.port, openedProjectWindow: true, version: target.version })
  })
  mocks.assertPort.mockResolvedValue(undefined)
  mocks.persist.mockResolvedValue(undefined)
})

describe('managed automator port ownership', () => {
  it('initializes the resolved project with the selected installation before creating a window intent', async () => {
    const scope = createScope()
    await launchManagedAutomator({ ...options, launcher: { connect: vi.fn(async () => createProgram()) } as any, scope, target })
    expect(mocks.importProject).toHaveBeenCalledExactlyOnceWith({
      cliPath: target.cliPath,
      projectPath: options.projectPath,
      trusted: true,
      timeout: 10_000,
      signal: scope.signal,
    })
    expect(mocks.importProject.mock.invocationCallOrder[0]).toBeLessThan(mocks.begin.mock.invocationCallOrder[0]!)
  })

  it('does not acquire a port or create a window when official initialization fails', async () => {
    const failure = new Error('official import failed')
    mocks.importProject.mockRejectedValue(failure)
    await expect(launchManagedAutomator({ ...options, launcher: { connect: vi.fn() } as any, scope: createScope(), target })).rejects.toBe(failure)
    expect(mocks.lease).not.toHaveBeenCalled()
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('leases the selected port before starting the IDE and releases it on session close', async () => {
    const scope = createScope()
    const program = createProgram()
    const launcher = { connect: vi.fn(async () => program) } as any

    const connected = await launchManagedAutomator({ ...options, launcher, scope, target })

    expect(mocks.lease).toHaveBeenCalledExactlyOnceWith(options.port)
    expect(mocks.begin.mock.invocationCallOrder[0]).toBeLessThan(mocks.start.mock.invocationCallOrder[0]!)
    expect(mocks.release).not.toHaveBeenCalled()
    connected.disconnect()
    await Promise.resolve()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('releases the port lease when agent startup fails', async () => {
    const scope = createScope()
    const owner = createOwner()
    const failure = new Error('agent start failed')
    mocks.begin.mockResolvedValue(owner)
    mocks.start.mockRejectedValue(failure)

    await expect(launchManagedAutomator({ ...options, launcher: { connect: vi.fn() } as any, scope, target })).rejects.toBe(failure)
    expect(owner.fail).toHaveBeenCalledExactlyOnceWith(failure)
    expect(owner.close).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('refuses a leased port before creating a project ownership record', async () => {
    const scope = createScope()
    const failure = new Error('Port 58802 is in use, please specify another port')
    mocks.lease.mockRejectedValue(failure)

    await expect(launchManagedAutomator({ ...options, launcher: { connect: vi.fn() } as any, scope, target })).rejects.toBe(failure)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
  })
})
