import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordedStream, streamChunks } from '../src/fixtures/afterSales'
import { createDemoSession } from '../src/runtime/session'

afterEach(() => vi.useRealTimers())

describe('售后业务使用公共 renderer', () => {
  it('writes input once, prevents duplicate submissions and supports failure then retry', async () => {
    vi.useFakeTimers()
    const session = createDemoSession()
    session.receive({ id: 'reason', name: 'input', value: '模拟失败' })
    session.receive({ id: 'submit', name: 'press' })
    session.receive({ id: 'submit', name: 'press' })
    expect(session.model.value.submissions).toBe(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(session.model.value.state.error).toContain('暂不可用')
    session.receive({ id: 'reason', name: 'input', value: '杯盖有划痕' })
    session.receive({ id: 'submit', name: 'press' })
    await vi.advanceTimersByTimeAsync(600)
    expect(session.model.value.state.submitted).toBe(true)
    expect(session.model.value.state.error).toBe('')
    session.dispose()
  })

  it('preserves user input across streamed changes and retains the last valid UI on failure', () => {
    const session = createDemoSession()
    session.receive({ id: 'reason', name: 'input', value: '保留我的输入' })
    for (const chunk of streamChunks(recordedStream)) {
      session.push(chunk)
    }
    session.push('', true)
    expect(session.model.value.state.form.reason).toBe('保留我的输入')
    expect(session.model.value.spec.elements.form?.props).toEqual({ title: '申请售后 · 专属服务' })
    const before = JSON.stringify(session.model.value.spec)
    session.push('{"op":"replace","path":"/elements/root/type","value":"Unknown"}\n')
    expect(session.model.value.error).not.toBe('')
    expect(JSON.stringify(session.model.value.spec)).toBe(before)
    session.reset()
    expect(session.model.value.error).toBe('')
    expect(session.model.value.state.form.reason).toBe('')
    session.dispose()
  })

  it('cancels playback and submission on disposal without late state writes', async () => {
    vi.useFakeTimers()
    const session = createDemoSession()
    session.receive({ id: 'reason', name: 'input', value: '杯盖有划痕' })
    session.receive({ id: 'submit', name: 'press' })
    session.play()
    session.dispose()
    const snapshot = JSON.stringify(session.model.value)
    await vi.runAllTimersAsync()
    expect(JSON.stringify(session.model.value)).toBe(snapshot)
    expect(vi.getTimerCount()).toBe(0)
  })
})
