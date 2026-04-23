import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerOpenCommand } from './open'

const openIdeMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const resolveIdeProjectRootMock = vi.hoisted(() => vi.fn())
const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const resolveRuntimeTargetsMock = vi.hoisted(() => vi.fn(() => ({
  mpPlatform: 'weapp',
  rawPlatform: 'weapp',
})))
const readLatestHmrProfileSummaryMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
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
  })

  it('opens ide without summary when no hmr profile is available', async () => {
    const action = createOpenActionHandler()

    await action(undefined, { trustProject: false })

    expect(loggerMock.info).not.toHaveBeenCalled()
    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/workspace/demo/dist/dev', {
      trustProject: false,
    })
  })
})
