import { afterEach, describe, expect, it, vi } from 'vitest'
import { afterSalesSpec, recordedStream, streamChunks } from '../src/fixtures/afterSales'
import { initialState, projectSpec } from '../src/runtime/projection'
import { validateSpec } from '../src/runtime/schema'
import { createDemoSession } from '../src/runtime/session'
import { createDemoStream } from '../src/runtime/stream'

afterEach(() => vi.useRealTimers())
const copy = () => JSON.parse(JSON.stringify(afterSalesSpec)) as typeof afterSalesSpec

describe('Wevu JSON renderer', () => {
  it('resolves text, input bindings and conditional visibility with Core', () => {
    const state = initialState()
    state.form.reason = '杯盖有划痕'
    state.busy = true
    const tree = projectSpec(afterSalesSpec, state)!
    const form = tree.children.find(node => node.id === 'form')!
    expect(form.children.map(node => node.id)).toEqual(['reason', 'submit'])
    expect(form.children[0]?.props.value).toBe('杯盖有划痕')
    expect(form.children[1]?.props.disabled).toBe(true)
  })

  it('rejects unsupported grammar, missing references, cycles and oversized trees', () => {
    expect(() => validateSpec({ ...copy(), repeat: {} })).toThrow()
    const missing = copy()
    missing.elements.root!.children.push('absent')
    expect(() => validateSpec(missing)).toThrow('引用不存在')
    expect(validateSpec(missing, true).complete).toBe(false)
    const cyclic = copy()
    cyclic.elements.form!.children.push('root')
    expect(() => validateSpec(cyclic)).toThrow('循环引用')
    const deep = copy()
    for (let i = 0; i < 9; i++) {
      deep.elements[`depth${i}`] = { type: 'Stack', props: {}, children: i < 8 ? [`depth${i + 1}`] : [] }
    }
    expect(() => validateSpec(deep)).toThrow('深度')
    const wide = copy()
    for (let i = 0; i < 201; i++) {
      wide.elements[`item${i}`] = { type: 'Text', props: { text: '' }, children: [] }
    }
    expect(() => validateSpec(wide)).toThrow('200')
  })

  it('waits for missing nodes and accepts arbitrarily split JSONL including a final line without newline', () => {
    const stream = createDemoStream(copy())
    expect(stream.push('{"op":"add","path":"/elements/root/children/-","value":"extra"}\n')).toBeNull()
    const final = '{"op":"add","path":"/elements/extra","value":{"type":"Text","props":{"text":"补充说明"},"children":[]}}'
    for (const char of final) {
      expect(stream.push(char)).toBeNull()
    }
    expect(stream.push('', true)?.elements.extra?.props).toEqual({ text: '补充说明' })
  })

  it('applies identical array operations twice and isolates failed transactions from the visible spec', () => {
    const original = copy()
    const stream = createDemoStream(original)
    const remove = '{"op":"remove","path":"/elements/form/children/1"}\n'
    expect(stream.push(remove + remove)?.elements.form?.children).toEqual(['reason', 'error'])
    expect(original).toEqual(afterSalesSpec)
    expect(() => stream.push('{"op":"replace","path":"/elements/form/type","value":"Unknown"}\n')).toThrow()
    expect(original).toEqual(afterSalesSpec)
  })

  it.each([
    '{broken}\n',
    '{"op":"add","path":"/state","value":{}}\n',
    '{"op":"add","path":"/elements/__proto__/polluted","value":true}\n',
    '{"op":"copy","path":"/root","from":"/root"}\n',
  ])('rejects malformed or out-of-scope patches', (line) => {
    expect(() => createDemoStream(copy()).push(line)).toThrow()
  })

  it('writes input once, prevents duplicate submissions and supports failure then retry', () => {
    vi.useFakeTimers()
    const session = createDemoSession()
    session.receive({ id: 'reason', name: 'input', value: '模拟失败' })
    session.receive({ id: 'submit', name: 'press' })
    session.receive({ id: 'submit', name: 'press' })
    expect(session.model.submissions).toBe(1)
    vi.advanceTimersByTime(600)
    expect(session.model.state.error).toContain('暂不可用')
    session.receive({ id: 'reason', name: 'input', value: '杯盖有划痕' })
    session.receive({ id: 'submit', name: 'press' })
    vi.advanceTimersByTime(600)
    expect(session.model.state.submitted).toBe(true)
    expect(session.model.state.error).toBe('')
    session.dispose()
  })

  it('preserves user input across streamed changes and retains the last valid UI on failure', () => {
    const session = createDemoSession()
    session.receive({ id: 'reason', name: 'input', value: '保留我的输入' })
    for (const chunk of streamChunks(recordedStream)) {
      session.push(chunk)
    }
    session.push('', true)
    expect(session.model.state.form.reason).toBe('保留我的输入')
    expect(session.model.spec.elements.form?.props).toEqual({ title: '申请售后 · 专属服务' })
    const before = JSON.stringify(session.model.spec)
    session.push('{"op":"replace","path":"/elements/root/type","value":"Unknown"}\n')
    expect(session.model.error).not.toBe('')
    expect(JSON.stringify(session.model.spec)).toBe(before)
    session.reset()
    expect(session.model.error).toBe('')
    expect(session.model.state.form.reason).toBe('')
    session.dispose()
  })

  it('cancels playback and submission on disposal without late state writes', () => {
    vi.useFakeTimers()
    const session = createDemoSession()
    session.receive({ id: 'reason', name: 'input', value: '杯盖有划痕' })
    session.receive({ id: 'submit', name: 'press' })
    session.play()
    session.dispose()
    const snapshot = JSON.stringify(session.model)
    vi.runAllTimers()
    expect(JSON.stringify(session.model)).toBe(snapshot)
    expect(vi.getTimerCount()).toBe(0)
  })
})
