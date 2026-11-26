import type { A2uiNode } from '@wevu/a2ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoSession } from '../src/runtime/session'

type DemoSession = ReturnType<typeof createDemoSession>

function nodeOf(session: DemoSession, componentId: string): A2uiNode {
  const walk = (node: A2uiNode | undefined): A2uiNode | undefined => {
    if (!node) {
      return undefined
    }
    if (node.componentId === componentId) {
      return node
    }
    for (const child of node.children) {
      const found = walk(child)
      if (found) {
        return found
      }
    }
    return undefined
  }
  const found = walk(session.root.value)
  if (!found) {
    throw new Error(`missing node: ${componentId}`)
  }
  return found
}

/** 页面在同步 setup 中先建会话再下发首屏，测试沿用同一顺序。 */
function setup() {
  const session = createDemoSession()
  session.load()
  return session
}

afterEach(() => vi.useRealTimers())

describe('A2UI 售后演示会话', () => {
  it('输入写回数据模型并驱动绑定文本', () => {
    const session = setup()
    const field = nodeOf(session, 'reason')
    session.interact({ type: 'input', nodeId: field.id, value: '杯盖有划痕' })

    expect(session.model.value.reason).toBe('杯盖有划痕')
    expect(session.model.value.detail).toBe('')
    expect(nodeOf(session, 'reason').id).toBe(field.id)
    expect(session.model.value.delivered).toBe(0)
    session.dispose()
  })

  it('用标准函数投影校验反馈并在有效输入后清除', () => {
    const session = setup()
    expect(nodeOf(session, 'reason').props).toMatchObject({
      isValid: false,
      validationErrors: ['请填写售后原因', '至少填写四个字'],
    })
    expect(nodeOf(session, 'submit').props).toMatchObject({
      isValid: false,
      validationErrors: ['请先填写有效的售后原因'],
    })

    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '短' })
    expect(nodeOf(session, 'reason').props).toMatchObject({
      isValid: false,
      validationErrors: ['至少填写四个字'],
    })

    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '杯盖有划痕' })
    expect(nodeOf(session, 'reason').props).toMatchObject({ isValid: true, validationErrors: [] })
    expect(nodeOf(session, 'submit').props).toMatchObject({ isValid: true, validationErrors: [] })
    session.dispose()
  })

  it('动作外发后由 agent 回包，提交进行中重复点击被去重', async () => {
    vi.useFakeTimers()
    const session = setup()
    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '杯盖有划痕' })
    const submit = nodeOf(session, 'submit')
    session.interact({ type: 'action', nodeId: submit.id })
    session.interact({ type: 'action', nodeId: submit.id })

    expect(session.model.value.submissions).toBe(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(session.model.value.status).toBe('正在提交申请…')
    await vi.advanceTimersByTimeAsync(600)

    expect(session.model.value.delivered).toBe(1)
    expect(session.model.value.status).toBe('申请已提交，我们会尽快联系你')
    expect(session.model.value.steps).toHaveLength(3)
    expect(session.model.value.actionNames).toEqual(['submit'])
    session.dispose()
  })

  it('失败原因可修改后重试', async () => {
    vi.useFakeTimers()
    const session = setup()
    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '模拟失败' })
    session.interact({ type: 'action', nodeId: nodeOf(session, 'submit').id })
    await vi.advanceTimersByTimeAsync(600)
    expect(session.model.value.error).toBe('')
    expect(session.model.value.status).toBe('提交未完成')

    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '杯盖有划痕' })
    session.interact({ type: 'action', nodeId: nodeOf(session, 'submit').id })
    await vi.advanceTimersByTimeAsync(600)
    expect(session.model.value.status).toBe('申请已提交，我们会尽快联系你')
    session.dispose()
  })

  it('增量更新保留输入，非法消息保留上一版界面', () => {
    vi.useFakeTimers()
    const session = setup()
    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '请保留这段内容' })
    session.play()
    vi.advanceTimersByTime(500)

    expect(session.model.value.playing).toBe(false)
    expect(session.model.value.reason).toBe('请保留这段内容')
    expect(session.model.value.title).toBe('申请售后 · 专属服务')
    expect(session.model.value.progress).toContain('24 小时')
    expect(session.model.value.hint).toBe('')
    expect(nodeOf(session, 'hint')).toBeTruthy()
    expect(session.model.value.steps).toHaveLength(3)

    session.injectInvalid()
    expect(session.model.value.error).not.toBe('')
    expect(session.model.value.progress).toContain('24 小时')

    session.reset()
    expect(session.model.value.error).toBe('')
    expect(session.model.value.reason).toBe('')
    expect(session.model.value.hint).toBe('请描述商品问题，方便我们为你处理。')
    expect(session.model.value.progress).toBe('')
    expect(session.model.value.surfaceIds).toEqual(['after-sales'])
    session.dispose()
  })

  it('卸载后取消进行中的动作，不再外发也不再写入界面', async () => {
    vi.useFakeTimers()
    const session = setup()
    session.interact({ type: 'input', nodeId: nodeOf(session, 'reason').id, value: '杯盖有划痕' })
    session.interact({ type: 'action', nodeId: nodeOf(session, 'submit').id })
    session.play()
    // 动作在外层 Promise 完成后才交给 onAction；此时卸载必须阻止迟到的外发与回包。
    session.dispose()

    expect(session.model.value.surfaceIds).toEqual([])
    expect(session.model.value.status).toBe('')
    await vi.runAllTimersAsync()
    expect(session.model.value.delivered).toBe(0)
    expect(session.model.value.replies).toBe(0)
    expect(session.model.value.error).toBe('')
    expect(vi.getTimerCount()).toBe(0)
  })
})
