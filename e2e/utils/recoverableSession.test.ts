import { describe, expect, it, vi } from 'vitest'
import { createRecoverableSession } from './recoverableSession'

function runtime(version: string) {
  return {
    version,
    route: '/initial',
    toolInfo: vi.fn(function (this: { version: string }) {
      return { version: this.version }
    }),
    navigateTo: vi.fn(function (this: { route: string }, route: string) {
      this.route = route
      return { path: route }
    }),
    close: vi.fn(),
  }
}

describe('recoverable runtime session', () => {
  it('uses the recovered connection for retained callers and bound methods', () => {
    const original = runtime('before')
    const recovered = runtime('after')
    const owner = createRecoverableSession(original)
    const caller = owner.session
    const toolInfo = caller.toolInfo
    expect(toolInfo()).toEqual({ version: 'before' })

    // 旧页面连接关闭后，DOM 验收和后续导航仍使用原调用方引用。
    owner.clear()?.close()
    owner.replace(recovered)
    expect(owner.session).toBe(caller)
    expect(toolInfo()).toEqual({ version: 'after' })
    expect(caller.toolInfo()).toEqual({ version: 'after' })
    expect(caller.navigateTo('/result')).toEqual({ path: '/result' })
    expect(caller.route).toBe('/result')
    expect(original.toolInfo).toHaveBeenCalledTimes(1)
    expect(original.navigateTo).not.toHaveBeenCalled()
    expect(original.close).toHaveBeenCalledTimes(1)
    expect(recovered.navigateTo).toHaveBeenCalledTimes(1)
  })

  it('forwards property mutations to the current connection', () => {
    const original = runtime('before')
    const recovered = runtime('after')
    const owner = createRecoverableSession(original)
    owner.session.route = '/first'
    owner.replace(recovered)
    owner.session.route = '/second'
    expect(original.route).toBe('/first')
    expect(recovered.route).toBe('/second')
  })

  it('fails immediately after close or failed recovery without reusing old transport', () => {
    const original = runtime('closed')
    const owner = createRecoverableSession(original)
    const toolInfo = owner.session.toolInfo
    expect(owner.clear()).toBe(original)
    expect(owner.clear()).toBeUndefined()
    expect(() => owner.session.toolInfo()).toThrow('closed or recovering')
    expect(toolInfo).toThrow('closed or recovering')
    expect(original.toolInfo).not.toHaveBeenCalled()
    const separate = createRecoverableSession(runtime('separate'))
    expect(separate.session.toolInfo()).toEqual({ version: 'separate' })
    expect(toolInfo).toThrow('closed or recovering')
  })
})
