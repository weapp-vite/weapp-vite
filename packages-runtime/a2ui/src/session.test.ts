import { A2uiIntegrityError, A2uiValidationError } from '@a2ui/web_core'
import { describe, expect, it } from 'vitest'
import {
  createSurfaceMessage,
  findNode,
  rootOf,
  setupSession,
  surfaceMessage,
} from './sessionTestUtils'

describe('createA2uiSession', () => {
  it('projects a component tree with bound text', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['title', 'name'] },
      { id: 'title', component: 'Text', text: 'Hello' },
      { id: 'name', component: 'Text', text: { '@path': '/name' } },
    ], { name: 'Alice' }))

    const root = rootOf(result)
    expect(root?.type).toBe('Column')
    expect(root?.children).toHaveLength(2)
    expect(root?.children[0]?.props.text).toBe('Hello')
    expect(root?.children[1]?.props.text).toBe('Alice')
    expect(root?.props.children).toBeUndefined()
    result.session.dispose()
  })

  it('writes input bindings back into the data model', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['field', 'echo'] },
      { id: 'field', component: 'TextField', label: '名字', value: { '@path': '/name' } },
      { id: 'echo', component: 'Text', text: { '@path': '/name' } },
    ], { name: 'Alice' }))

    const field = findNode(rootOf(result), 'field')
    expect(field?.props.value).toBe('Alice')
    await result.session.interact('s1', { type: 'input', nodeId: field!.id, value: 'Bob' })

    const echo = findNode(rootOf(result), 'echo')
    const updatedField = findNode(rootOf(result), 'field')
    expect(echo?.props.text).toBe('Bob')
    expect(updatedField?.props.value).toBe('Bob')
    expect(result.actions).toHaveLength(0)
    result.session.dispose()
  })

  it('dispatches button actions with resolved context', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['submit'] },
      {
        id: 'submit',
        component: 'Button',
        child: 'submitLabel',
        action: { event: { name: 'submit', context: { name: { '@path': '/name' } } } },
      },
      { id: 'submitLabel', component: 'Text', text: '提交' },
    ], { name: 'Alice' }))

    const button = findNode(rootOf(result), 'submit')
    expect(button?.actions).toEqual(['action'])
    expect(button?.children[0]?.props.text).toBe('提交')
    await result.session.interact('s1', { type: 'action', nodeId: button!.id })

    expect(result.actions).toHaveLength(1)
    const action = result.actions[0]!.action
    expect(result.actions[0]!.version).toBe('1.0')
    expect(action.name).toBe('submit')
    expect(action.surfaceId).toBe('s1')
    expect(action.sourceComponentId).toBe('submit')
    expect(action.context.name).toBe('Alice')
    expect(typeof action.timestamp).toBe('string')
    result.session.dispose()
  })

  it('spawns templated children from the data model', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'List', children: { componentId: 'item', path: '/items' } },
      { id: 'item', component: 'Text', text: { '@path': 'name' } },
    ], { items: [{ name: 'A' }, { name: 'B' }] }))

    let root = rootOf(result)
    expect(root?.children.map(child => child.props.text)).toEqual(['A', 'B'])
    const previousIds = root?.children.map(child => child.id)

    result.session.receive(surfaceMessage('updateDataModel', {
      surfaceId: 's1',
      path: '/items',
      value: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    }))

    root = rootOf(result)
    expect(root?.children.map(child => child.props.text)).toEqual(['A', 'B', 'C'])
    expect(root?.children[0]!.id).not.toBe(previousIds?.[0])
    result.session.dispose()
  })

  it('rejects non-state messages and empty surface ids', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Text', text: 'ok' },
    ]))

    expect(() => result.session.receive({ version: '1.0', callRendererFunction: {} })).toThrow(A2uiValidationError)
    expect(() => result.session.receive(surfaceMessage('createSurface', { surfaceId: '', components: [] }))).toThrow(A2uiValidationError)
    expect(rootOf(result)?.props.text).toBe('ok')
    result.session.dispose()
  })

  it('re-projects primitive data model writes at a path', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['status'] },
      { id: 'status', component: 'Text', text: { '@path': '/status' } },
    ], { status: 'idle' }))
    const batches = result.batches.length

    result.session.receive(surfaceMessage('updateDataModel', { surfaceId: 's1', path: '/status', value: 'done' }))

    expect(result.batches.length).toBeGreaterThan(batches)
    expect(rootOf(result)?.children[0]?.props.text).toBe('done')
    expect(rootOf(result)?.children[0]?.id).toMatch(/-v0$/)
    result.session.dispose()
  })

  it('removes a data model path without replacing bound nodes', () => {
    const result = setup()
    result.session.receive(createSurface('s1', [
      { id: 'root', component: 'Text', text: { '@path': '/status' } },
    ], { status: 'idle' }))
    const previous = rootOf(result)

    result.session.receive(surface('updateDataModel', { surfaceId: 's1', path: '/status', value: null }))

    const updated = rootOf(result)
    expect(updated?.props.text).toBeNull()
    expect(updated?.id).toBe(previous?.id)
    expect(updated?.id).toMatch(/-v0$/)
    result.session.dispose()
  })

  it('rejects updates that orphan a component and keeps the previous tree', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['title', 'extra'] },
      { id: 'title', component: 'Text', text: 'Hello' },
      { id: 'extra', component: 'Text', text: 'Extra' },
    ]))

    expect(() => result.session.receive(surfaceMessage('updateComponents', {
      surfaceId: 's1',
      components: [{ id: 'root', component: 'Column', children: ['title'] }],
    }))).toThrow(A2uiIntegrityError)
    expect(rootOf(result)?.children).toHaveLength(2)
    result.session.dispose()
  })

  it('removes surfaces on deleteSurface', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Text', text: 'ok' },
    ]))
    expect(result.latest()).toHaveLength(1)

    result.session.receive(surfaceMessage('deleteSurface', { surfaceId: 's1' }))
    expect(result.latest()).toHaveLength(0)
    result.session.dispose()
  })

  it('rolls back a failed createSurface so the id can be reused', () => {
    const result = setupSession()
    expect(() => result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['missing'] },
    ]))).toThrow()

    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Text', text: 'retry' },
    ]))
    expect(rootOf(result)?.props.text).toBe('retry')
    result.session.dispose()
  })

  it('stops notifying after dispose and stays idempotent', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Text', text: 'ok' },
    ]))
    const batchCount = result.batches.length
    result.session.dispose()
    result.session.dispose()
    result.session.receive(createSurfaceMessage('s2', [
      { id: 'root', component: 'Text', text: 'ignored' },
    ]))
    expect(result.batches.length).toBe(batchCount)
  })
})
