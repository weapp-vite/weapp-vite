import { describe, expect, it } from 'vitest'
import { createSurfaceMessage, findNode, rootOf, setupSession } from './sessionTestUtils'

function buttonComponents() {
  return [
    { id: 'root', component: 'Column', children: ['name', 'submit'] },
    { id: 'name', component: 'TextField', label: '名字', value: { '@path': '/name' } },
    {
      id: 'submit',
      component: 'Button',
      child: 'submitLabel',
      action: { event: { name: 'submit', context: { name: { '@path': '/name' } } } },
    },
    { id: 'submitLabel', component: 'Text', text: '提交' },
  ]
}

describe('createA2uiSession renderer data model metadata', () => {
  it('attaches a deep snapshot without changing the action context', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', buttonComponents(), {
      name: 'Alice',
      profile: { city: 'Shanghai' },
    }, true))

    const button = findNode(rootOf(result), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(result.actionMetadata[0]).toEqual({
      a2uiRendererDataModel: {
        version: '1.0',
        surfaces: {
          s1: { name: 'Alice', profile: { city: 'Shanghai' } },
        },
      },
    })
    expect(result.actions[0]?.action.context).toEqual({ name: 'Alice' })

    const snapshot = result.actionMetadata[0]!
    const field = findNode(rootOf(result), 'name')!
    await result.session.interact('s1', { type: 'input', nodeId: field.id, value: 'Bob' })
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(snapshot.a2uiRendererDataModel?.surfaces.s1?.name).toBe('Alice')
    expect(result.actionMetadata[1]?.a2uiRendererDataModel?.surfaces.s1?.name).toBe('Bob')
    expect(result.actions[1]?.action.context).toEqual({ name: 'Bob' })
    result.session.dispose()
  })

  it('includes every enabled surface and omits disabled surfaces', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', buttonComponents(), { name: 'Alice' }, true))
    result.session.receive(createSurfaceMessage('s2', buttonComponents(), { name: 'Disabled' }, false))
    result.session.receive(createSurfaceMessage('s3', buttonComponents(), { name: 'Carol' }, true))

    const button = findNode(rootOf(result, 's1'), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(result.actionMetadata[0]?.a2uiRendererDataModel?.surfaces).toEqual({
      s1: { name: 'Alice' },
      s3: { name: 'Carol' },
    })
    result.session.dispose()
  })

  it('does not pass metadata when sendDataModel is disabled', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', buttonComponents(), { name: 'Alice' }))
    const button = findNode(rootOf(result), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(result.actions).toHaveLength(1)
    expect(result.actionMetadata[0]).toBeUndefined()
    result.session.dispose()
  })

  it('passes the same transport metadata to onError', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['submit'] },
      {
        id: 'submit',
        component: 'Button',
        child: 'submitLabel',
        action: {
          event: {
            name: 'submit',
            context: { result: { '@call': 'resolveValue', 'args': { value: 'unused' } } },
          },
        },
      },
      { id: 'submitLabel', component: 'Text', text: '提交' },
    ], { name: 'Alice' }, true))

    const button = findNode(rootOf(result), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(result.actions).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errorMetadata[0]?.a2uiRendererDataModel?.surfaces.s1).toEqual({ name: 'Alice' })
    result.session.dispose()
  })
})
