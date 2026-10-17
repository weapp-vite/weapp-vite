import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponentFixture } from '../test/componentFixture'
import { createTestProject } from './project'

describe('component render harness', () => {
  const cleanups: (() => Promise<void>)[] = []

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup()
    }
  })

  function fixture() {
    const projectPath = createComponentFixture()
    const project = createTestProject({ artifact: { projectPath } })
    cleanups.push(async () => {
      try {
        await project.close()
      }
      finally {
        fs.rmSync(projectPath, { force: true, recursive: true })
      }
    })
    return project
  }

  it('replaces recursive descendants with artifact paths or declarative stubs per render', async () => {
    const project = fixture()
    const original = await project.renderComponent('components/subject/index')
    const replaced = await project.renderComponent('components/subject/index', {
      usingComponents: { leaf: 'components/replacement/index' },
    })
    const stubbed = await project.renderComponent('components/subject/index', {
      properties: { label: 'stubbed' },
      slots: { default: '<text>provided slot</text>' },
      usingComponents: {
        leaf: {
          template: '<text>stub {{label}} {{suffix}}</text>',
          properties: { label: '' },
          data: { suffix: 'data' },
        },
      },
    })

    expect(original.screen.getByText('original initial')).toBeDefined()
    expect(replaced.screen.getByText('replacement initial')).toBeDefined()
    expect(stubbed.screen.getByText('stub stubbed data')).toBeDefined()
    expect(stubbed.screen.getByText('provided slot')).toBeDefined()
    expect(original.screen.queryByText('replacement initial')).toBeNull()
    expect(replaced.screen.queryByText('stub stubbed data')).toBeNull()
  })

  it('updates properties and local data on the same subject instance', async () => {
    const result = await fixture().renderComponent('components/subject/index', { properties: { value: 2 } })
    const subject = await result.page.selectComponent('#mpcore-subject')
    const scoped = result.screen.within(result.screen.getByTestId('subject'))
    expect(subject).not.toBeNull()
    expect(await subject!.callMethod('observerState')).toEqual([])
    await result.setData({ local: 8 })
    await result.setProperties({ label: 'updated', value: 5 })
    expect(scoped.getByText('updated:5:8')).toBeDefined()
    expect(await subject!.callMethod('state')).toEqual({
      created: 1,
      attached: 1,
      local: 8,
      label: 'updated',
      value: 5,
    })
    expect(await subject!.callMethod('observerState')).toEqual([{ value: 'updated', previous: 'initial' }])
    const stop = result.on('change')
    result.off('change')
    stop()
    expect(await subject!.callMethod('observerState')).toEqual([{ value: 'updated', previous: 'initial' }])
    await result.unmount()
    expect(() => scoped.getByText('updated:5:8')).toThrow('no longer present')
  })

  it('subscribes and unsubscribes declared host events without replacing the subject', async () => {
    const result = await fixture().renderComponent('components/subject/index')
    const subject = (await result.page.selectComponent('#mpcore-subject'))!
    await result.setData({ local: 9 })
    await subject.callMethod('emit')
    expect(result.emitted('change')).toEqual([])

    const stopRecording = result.on('change')
    const listener = vi.fn()
    const stopListener = result.on('change', listener)
    await subject.callMethod('emit')
    expect(listener).toHaveBeenCalledOnce()
    expect(result.emitted('change')).toEqual([{ local: 9, label: 'initial' }])
    stopListener()
    await subject.callMethod('emit')
    expect(listener).toHaveBeenCalledOnce()
    expect(result.emitted('change')).toHaveLength(2)
    stopRecording()
    await subject.callMethod('emit')
    expect(result.emitted('change')).toHaveLength(2)
    expect(await subject.callMethod('state')).toMatchObject({ created: 1, attached: 1, local: 9 })

    result.on('change', listener)
    result.off('change', listener)
    await subject.callMethod('emit')
    expect(listener).toHaveBeenCalledOnce()
    expect(result.emitted('change')).toHaveLength(2)

    const stale = result.on('change', listener)
    result.off('change', listener)
    const first = result.on('change', listener)
    const second = result.on('change', listener)
    stale()
    await subject.callMethod('emit')
    expect(listener).toHaveBeenCalledTimes(3)
    first()
    await subject.callMethod('emit')
    expect(listener).toHaveBeenCalledTimes(4)
    second()
    await subject.callMethod('emit')
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('records explicit event names without callbacks from the first render', async () => {
    const result = await fixture().renderComponent('components/subject/index', { events: ['change', 'mount'] })
    expect(result.emitted('mount')).toEqual([{ phase: 'attached' }])
    await (await result.page.selectComponent('#mpcore-subject'))!.callMethod('emit')
    expect(result.emitted('change')).toEqual([{ local: 1, label: 'initial' }])
    result.off('change')
    await (await result.page.selectComponent('#mpcore-subject'))!.callMethod('emit')
    expect(result.emitted('change')).toHaveLength(1)
  })

  it.each(['update:label', 'change.detail', 'custom-event'])('supports punctuation in declared and dynamic event subscriptions: %s', async (eventName) => {
    const declared = vi.fn()
    const result = await fixture().renderComponent('components/subject/index', { on: { [eventName]: declared } })
    const subject = (await result.page.selectComponent('#mpcore-subject'))!
    await subject.callMethod('emitNamed', eventName, { value: 'declared' })
    expect(declared).toHaveBeenCalledWith({ value: 'declared' }, expect.objectContaining({ type: eventName }))
    result.off(eventName)

    const dynamic = vi.fn()
    const stop = result.on(eventName, dynamic)
    await subject.callMethod('emitNamed', eventName, { value: 'dynamic' })
    expect(declared).toHaveBeenCalledOnce()
    expect(dynamic).toHaveBeenCalledWith({ value: 'dynamic' }, expect.objectContaining({ type: eventName }))
    expect(result.emitted(eventName)).toEqual([{ value: 'declared' }, { value: 'dynamic' }])
    stop()
    await subject.callMethod('emitNamed', eventName, { value: 'stopped' })
    expect(dynamic).toHaveBeenCalledOnce()
  })

  it('copies update inputs and validates them before changing bindings', async () => {
    const result = await fixture().renderComponent('components/subject/index')
    const scope = (await result.page.selectComponent('#mpcore-subject'))!
    const input = { nested: { value: 3 } }
    const pending = result.setData({ payload: input })
    input.nested.value = 7
    await pending
    expect((await scope.snapshot())?.data.payload).toEqual({ nested: { value: 3 } })

    const propertyInput = { value: 3 }
    const propertyUpdate = result.setProperties({ payload: propertyInput })
    propertyInput.value = 8
    await propertyUpdate
    const snapshot = await scope.snapshot()
    expect((snapshot?.properties as Record<string, unknown> | undefined)?.payload).toEqual({ value: 3 })

    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    await expect(result.setProperties({ label: cyclic })).rejects.toThrow('serializable')
    await expect(result.setData({ payload: () => 1 })).rejects.toThrow('serializable')
    await expect(result.setProperties({ 'invalid"name': 'no' })).rejects.toThrow('valid WXML attribute')
    await result.setProperties({ label: 'valid' })
    expect(result.screen.getByText('valid:0:1')).toBeDefined()
    expect((await scope.callMethod('state')).created).toBe(1)
  })

  it('rejects invalid generated bindings and non-declarative inline stub data', async () => {
    const project = fixture()
    const result = await project.renderComponent('components/subject/index')
    for (const eventName of ['invalid name', 'invalid"name']) {
      await expect(project.renderComponent('components/subject/index', { events: [eventName] })).rejects.toThrow('Component event names')
      expect(() => result.on(eventName)).toThrow('Component event names')
    }
    await expect(project.renderComponent('components/subject/index', {
      slots: { 'invalid"slot': '<text />' },
    })).rejects.toThrow('valid WXML attribute')
    await expect(project.renderComponent('components/subject/index', {
      usingComponents: { leaf: { data: { method: () => 1 } } },
    })).rejects.toThrow('serializable')
    await expect(project.renderComponent('components/subject/index', {
      usingComponents: { leaf: '../outside' },
    })).rejects.toThrow('artifact root')
  })

  it('unmounts just the subject through native removal and rejects later updates', async () => {
    const project = fixture()
    const first = await project.renderComponent('components/subject/index')
    const second = await project.renderComponent('components/subject/index')
    const scope = (await first.page.selectComponent('#mpcore-subject'))!
    const owner = await scope.ownerComponent()
    expect(owner).toBeNull()
    const lifecycle = await scope.callMethod('lifecycleState')

    await first.unmount()
    await first.unmount()
    expect(await first.page.selectComponent('#mpcore-subject')).toBeNull()
    expect(await scope.snapshot()).toBeNull()
    expect(first.screen.queryByTestId('subject')).toBeNull()
    expect(second.screen.getByTestId('subject')).toBeDefined()
    expect(await first.page.data('__mpcoreMounted')).toBe(false)
    expect(lifecycle.detached).toBe(1)
    await expect(first.setData({ local: 2 })).rejects.toThrow('unmounted')
    await expect(first.setProperties({ label: 'late' })).rejects.toThrow('unmounted')
    expect(() => first.on('change')).toThrow('unmounted')
    await first.close()
    await first.close()
    expect(lifecycle.detached).toBe(1)
  })

  it('rejects unmount errors while releasing subscriptions without repeating detached', async () => {
    const project = fixture()
    const result = await project.renderComponent('components/subject/index')
    const subject = (await result.page.selectComponent('#mpcore-subject'))!
    const lifecycle = await subject.callMethod('lifecycleState')
    const dispose = result.on('change')
    await result.setData({ failDetach: true })

    await expect(result.unmount()).rejects.toThrow('detached failure')
    expect(await result.page.selectComponent('#mpcore-subject')).toBeNull()
    expect(await subject.snapshot()).toBeNull()
    expect(result.diagnostics()).toContainEqual(expect.objectContaining({
      level: 'exception',
      args: expect.arrayContaining([expect.objectContaining({ message: 'detached failure' })]),
    }))
    expect(() => result.off('change')).not.toThrow()
    expect(dispose).not.toThrow()
    await expect(result.unmount()).rejects.toThrow('detached failure')
    expect(lifecycle.detached).toBe(1)
    await expect(result.close()).rejects.toThrow('detached failure')
    await project.close()
    expect(lifecycle.detached).toBe(1)
  })

  it('releases subscriptions and project ownership when detached throws during close', async () => {
    const project = fixture()
    const result = await project.renderComponent('components/subject/index')
    const subject = (await result.page.selectComponent('#mpcore-subject'))!
    const lifecycle = await subject.callMethod('lifecycleState')
    const dispose = result.on('change')
    await result.setData({ failDetach: true })

    await expect(result.close()).rejects.toThrow('detached failure')
    expect(() => result.off('change')).not.toThrow()
    expect(dispose).not.toThrow()
    await project.close()
    await project.close()
    await result.close()
    expect(lifecycle.detached).toBe(1)
  })
})
