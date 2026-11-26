import { A2uiValidationError } from '@a2ui/web_core/errors'
import { describe, expect, it } from 'vitest'
import { createSurfaceMessage, findNode, rootOf, setupSession, surfaceMessage } from './sessionTestUtils'

describe('createA2uiSession batches', () => {
  it('applies a standard message array and publishes only the final view', () => {
    const result = setupSession()
    result.session.receive([
      createSurfaceMessage('s1', [
        { id: 'root', component: 'Text', text: { '@path': '/status' } },
      ], { status: 'before' }),
      surfaceMessage('updateDataModel', { surfaceId: 's1', path: '/status', value: 'after' }),
    ])

    expect(result.batches).toHaveLength(1)
    expect(rootOf(result)?.props.text).toBe('after')
    result.session.dispose()
  })

  it('accepts a messages wrapper and commits multiple surfaces together', () => {
    const result = setupSession()
    result.session.receive({
      messages: [
        createSurfaceMessage('s1', [{ id: 'root', component: 'Text', text: 'first' }]),
        createSurfaceMessage('s2', [{ id: 'root', component: 'Text', text: 'second' }]),
      ],
    })

    expect(result.batches).toHaveLength(1)
    expect(result.latest().map(view => view.id)).toEqual(['s1', 's2'])
    expect(rootOf(result, 's2')?.props.text).toBe('second')
    result.session.dispose()
  })

  it('treats empty arrays and wrappers as no-ops', () => {
    const result = setupSession()
    result.session.receive([])
    result.session.receive({ messages: [] })
    expect(result.batches).toHaveLength(0)
    result.session.dispose()
  })

  it('prevalidates every envelope before applying the batch', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Text', text: { '@path': '/status' } },
    ], { status: 'before' }))
    const batchCount = result.batches.length

    expect(() => result.session.receive([
      surfaceMessage('updateDataModel', { surfaceId: 's1', path: '/status', value: 'after' }),
      { version: '1.0', callRendererFunction: {} },
    ])).toThrow(A2uiValidationError)
    expect(rootOf(result)?.props.text).toBe('before')
    expect(result.batches).toHaveLength(batchCount)
    result.session.dispose()
  })

  it('keeps earlier successful messages when a later message fails processing', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['status', 'target'] },
      { id: 'status', component: 'Text', text: { '@path': '/status' } },
      { id: 'target', component: 'Text', text: { '@path': '/new/foo' } },
    ], { status: 'before' }))
    const batchCount = result.batches.length

    expect(() => result.session.receive([
      surfaceMessage('updateDataModel', { surfaceId: 's1', path: '/status', value: 'after' }),
      surfaceMessage('updateDataModel', { surfaceId: 's1', path: '/new/1/10001/x', value: true }),
    ])).toThrow()

    expect(findNode(rootOf(result), 'status')?.props.text).toBe('after')
    expect(findNode(rootOf(result), 'target')?.props.text).toBeNull()
    expect(result.batches).toHaveLength(batchCount + 1)
    result.session.dispose()
  })

  it('rejects wrappers with additional properties', () => {
    const result = setupSession()
    expect(() => result.session.receive({ messages: [], extra: true })).toThrow(A2uiValidationError)
    expect(result.batches).toHaveLength(0)
    result.session.dispose()
  })
})
