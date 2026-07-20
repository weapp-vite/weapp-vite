import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerOpenCommand } from './open'

const openIdeMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const resolveIdeProjectRootMock = vi.hoisted(() => vi.fn())
const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const resolveRuntimeTargetsMock = vi.hoisted(() => {
  const miniBackend = {
    descriptor: {
      id: 'miniprogram',
      capabilities: {
        ide: true,
      },
    },
    platform: 'weapp',
  }
  return vi.fn(() => ({
    kind: 'miniprogram',
    label: 'weapp',
    entries: [miniBackend],
    platform: 'weapp',
    rawPlatform: 'weapp',
    get: (id: string) => id === 'miniprogram' ? miniBackend : undefined,
  }))
})
const readLatestHmrProfileSummaryMock = vi.hoisted(() => vi.fn())
const maybeStartDetachedMcpServerMock = vi.hoisted(() => vi.fn())
const detectAiDevelopmentEnvironmentMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
}))

vi.mock('../../aiEnvironment', () => ({
  detectAiDevelopmentEnvironment: detectAiDevelopmentEnvironmentMock,
}))

vi.mock('../openIde', () => ({
  openIde: openIdeMock,
  resolveIdeCommandContext: resolveIdeCommandContextMock,
  resolveIdeProjectRoot: resolveIdeProjectRootMock,
}))

vi.mock('../options', () => ({
  filterDuplicateOptions: filterDuplicateOptionsMock,
  resolveConfigFile: resolveConfigFileMock,
}))

vi.mock('../runtime', () => ({
  resolveRuntimeTargets: resolveRuntimeTargetsMock,
}))

vi.mock('../hmrProfileSummary', () => ({
  readLatestHmrProfileSummary: readLatestHmrProfileSummaryMock,
}))

vi.mock('../mcpDetached', () => ({
  maybeStartDetachedMcpServer: maybeStartDetachedMcpServerMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

function createOpenActionHandler() {
  let actionHandler: ((root: string | undefined, options: any) => Promise<void>) | undefined
  const chain = {
    option: vi.fn(() => chain),
    action: vi.fn((handler: (root: string | undefined, options: any) => Promise<void>) => {
      actionHandler = handler
      return chain
    }),
  }
  const cli = {
    command: vi.fn(() => chain),
  }

  registerOpenCommand(cli as any)
  if (!actionHandler) {
    throw new Error('failed to capture open action handler')
  }
  return actionHandler
}

describe('open cli command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveConfigFileMock.mockReturnValue(undefined)
    resolveIdeCommandContextMock.mockResolvedValue({
      cwd: '/workspace/demo',
      platform: 'weapp',
      projectPath: '/workspace/demo/dist/dev',
      mpDistRoot: '/workspace/demo/dist/dev/mp-weixin',
      weappViteConfig: {},
    })
    resolveIdeProjectRootMock.mockReturnValue('/workspace/demo')
    readLatestHmrProfileSummaryMock.mockResolvedValue(undefined)
    maybeStartDetachedMcpServerMock.mockResolvedValue(undefined)
    detectAiDevelopmentEnvironmentMock.mockResolvedValue({
      agentName: 'codex',
      isAgent: true,
    })
    openIdeMock.mockResolvedValue(undefined)
  })

  it('prints latest hmr summary before opening ide when available', async () => {
    const action = createOpenActionHandler()
    readLatestHmrProfileSummaryMock.mockResolvedValue({
      line: '[hmr] 最近一次热更新 88.00 ms，update，src/pages/home/index.vue，主耗时 emit 30.00 ms',
      profilePath: '/workspace/demo/.weapp-vite/hmr-profile.jsonl',
    })

    await action(undefined, {})

    expect(readLatestHmrProfileSummaryMock).toHaveBeenCalledWith({
      cwd: '/workspace/demo',
      relativeCwd: expect.any(Function),
      weappViteConfig: {},
    })
    expect(loggerMock.info).toHaveBeenCalledWith('[hmr] 最近一次热更新 88.00 ms，update，src/pages/home/index.vue，主耗时 emit 30.00 ms')
    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/workspace/demo/dist/dev', {
      trustProject: undefined,
    })
    expect(maybeStartDetachedMcpServerMock).toHaveBeenCalledWith({
      agentName: 'codex',
      cwd: '/workspace/demo',
      isAgent: true,
      mcpConfig: undefined,
    })
  })

  it('opens ide without summary when no hmr profile is available', async () => {
    const action = createOpenActionHandler()

    await action(undefined, { trustProject: false })

    expect(loggerMock.info).not.toHaveBeenCalled()
    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/workspace/demo/dist/dev', {
      trustProject: false,
    })
  })

  it('passes mcp cli override before opening ide', async () => {
    const action = createOpenActionHandler()

    await action(undefined, {
      mcp: true,
    })

    expect(maybeStartDetachedMcpServerMock).toHaveBeenCalledWith({
      agentName: 'codex',
      cwd: '/workspace/demo',
      isAgent: true,
      mcpConfig: {
        autoStart: true,
        enabled: true,
      },
    })
  })

  it('forwards login retry controls to open ide', async () => {
    const action = createOpenActionHandler()

    await action(undefined, {
      loginRetry: 'never',
      loginRetryTimeout: '1000',
      nonInteractive: true,
      trustProject: false,
    })

    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/workspace/demo/dist/dev', {
      loginRetry: 'never',
      loginRetryTimeout: '1000',
      nonInteractive: true,
      trustProject: false,
    })
  })

  it('rejects a backend without ide capability', async () => {
    const webBackend = {
      descriptor: {
        id: 'web',
        capabilities: { ide: false },
      },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    const action = createOpenActionHandler()

    await expect(action(undefined, { platform: 'web' })).rejects.toThrow('`weapp-vite open` 当前仅支持小程序平台。')
    expect(resolveIdeCommandContextMock).not.toHaveBeenCalled()
  })
})
