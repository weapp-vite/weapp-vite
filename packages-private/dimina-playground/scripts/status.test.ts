import { describe, expect, it, vi } from 'vitest'
import { createStatusReporter } from '../src/status'

describe('host status during asynchronous startup', () => {
  it('retains build failure when openApp resolves after the first visible frame', () => {
    const render = vi.fn()
    const status = createStatusReporter('native', render)
    status.buildFailed('invalid syntax')
    status.opened()
    expect(render).toHaveBeenLastCalledWith('构建失败：invalid syntax')
    status.launchFailed('late launch rejection')
    expect(render).toHaveBeenLastCalledWith('构建失败：invalid syntax')
  })
  it('reports errors after launch and resets on a fresh host', () => {
    const render = vi.fn()
    const status = createStatusReporter('native', render)
    status.opened()
    status.buildFailed('invalid syntax')
    expect(render).toHaveBeenLastCalledWith('构建失败：invalid syntax')
    createStatusReporter('native', render).opened()
    expect(render).toHaveBeenLastCalledWith('native 示例已打开')
  })
  it('retains a reported launch failure when the SDK subsequently resolves', () => {
    const render = vi.fn()
    const status = createStatusReporter('native', render)
    status.launchFailed('missing config')
    status.opened()
    expect(render).toHaveBeenLastCalledWith('启动失败：missing config')
  })
})
