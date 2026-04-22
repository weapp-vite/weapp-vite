import { beforeEach, describe, expect, it, vi } from 'vitest'

const actionMock = vi.hoisted(() => vi.fn())
const buildWechatIdeNpmMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('weapp-ide-cli', () => ({
  buildWechatIdeNpm: buildWechatIdeNpmMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

describe('registerNpmCommand', () => {
  beforeEach(() => {
    vi.resetModules()
    actionMock.mockReset()
    buildWechatIdeNpmMock.mockReset()
    loggerMock.error.mockReset()
    buildWechatIdeNpmMock.mockResolvedValue(undefined)
  })

  it('delegates npm command to buildWechatIdeNpm helper', async () => {
    const cli = {
      command: vi.fn().mockReturnThis(),
      alias: vi.fn().mockReturnThis(),
      action: vi.fn((handler) => {
        actionMock.mockImplementation(handler)
        return cli
      }),
    }
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace/project')
    const { registerNpmCommand } = await import('./npm')

    try {
      registerNpmCommand(cli as any)
      await actionMock()
    }
    finally {
      cwdSpy.mockRestore()
    }

    expect(buildWechatIdeNpmMock).toHaveBeenCalledWith({
      projectPath: '/workspace/project',
    })
  })
})
