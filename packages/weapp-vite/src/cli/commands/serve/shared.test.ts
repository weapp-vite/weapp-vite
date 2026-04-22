import { describe, expect, it, vi } from 'vitest'
import { createServeMiniProgramDevActions } from './shared'

describe('serve shared helpers', () => {
  it('reuses forward console session before reopening ide project', async () => {
    const build = vi.fn().mockResolvedValue(undefined)
    const openIde = vi.fn().mockResolvedValue(undefined)
    const tryReuseForwardConsole = vi.fn().mockResolvedValue(true)
    const actions = createServeMiniProgramDevActions({
      build,
      fallbackProjectPath: '/project',
      openIde,
      projectPath: '/project/dist-root',
      tryReuseForwardConsole,
    })

    await expect(actions.openIde()).resolves.toBe('已通过控制台转发复用当前开发者工具会话')

    expect(actions.projectPath).toBe('/project/dist-root')
    expect(tryReuseForwardConsole).toHaveBeenCalledTimes(1)
    expect(openIde).not.toHaveBeenCalled()
  })

  it('falls back to reopening and rebuilding current mini program project', async () => {
    const build = vi.fn().mockResolvedValue(undefined)
    const openIde = vi.fn().mockResolvedValue(undefined)
    const tryReuseForwardConsole = vi.fn().mockResolvedValue(false)
    const actions = createServeMiniProgramDevActions({
      build,
      fallbackProjectPath: '/project',
      openIde,
      tryReuseForwardConsole,
    })

    await expect(actions.rebuild()).resolves.toBe('已手动重新构建当前小程序产物')
    await expect(actions.openIde()).resolves.toBe('已重新打开微信开发者工具项目')

    expect(actions.projectPath).toBe('/project')
    expect(build).toHaveBeenCalledTimes(1)
    expect(openIde).toHaveBeenCalledWith('/project')
  })
})
