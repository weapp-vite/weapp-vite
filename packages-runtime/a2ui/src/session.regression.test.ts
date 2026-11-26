import type { A2uiNode } from './types'
import { describe, expect, it } from 'vitest'
import {
  createSurfaceMessage,
  findNode,
  rootOf,
  setupSession,
  surfaceMessage,
} from './sessionTestUtils'
import { testCatalog } from './testFixture'

describe('createA2uiSession regressions', () => {
  it('selects the requested writable binding instead of the first one', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['field', 'labelEcho', 'valueEcho'] },
      { id: 'field', component: 'TextField', label: { '@path': '/label' }, value: { '@path': '/value' } },
      { id: 'labelEcho', component: 'Text', text: { '@path': '/label' } },
      { id: 'valueEcho', component: 'Text', text: { '@path': '/value' } },
    ], { label: 'Label', value: 'Value' }))

    const field = findNode(rootOf(result), 'field')!
    await expect(result.session.interact('s1', { type: 'input', nodeId: field.id, value: 'Ambiguous' }))
      .rejects
      .toThrow(/bindingName/)
    await expect(result.session.interact('s1', { type: 'input', nodeId: field.id, bindingName: 'missing', value: 'Invalid' }))
      .rejects
      .toThrow(/不存在名为 'missing'/)
    await result.session.interact('s1', { type: 'input', nodeId: field.id, bindingName: 'value', value: 'Changed' })

    expect(findNode(rootOf(result), 'labelEcho')?.props.text).toBe('Label')
    expect(findNode(rootOf(result), 'valueEcho')?.props.text).toBe('Changed')
    result.session.dispose()
  })

  it('selects the requested action when a node exposes more than one', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['submit'] },
      {
        id: 'submit',
        component: 'Button',
        child: 'submitLabel',
        action: { event: { name: 'primary' } },
        secondaryAction: { event: { name: 'secondary' } },
      },
      { id: 'submitLabel', component: 'Text', text: '提交' },
    ]))

    const button = findNode(rootOf(result), 'submit')!
    expect(button.actions).toEqual(['action', 'secondaryAction'])
    await expect(result.session.interact('s1', { type: 'action', nodeId: button.id }))
      .rejects
      .toThrow(/actionName/)
    await expect(result.session.interact('s1', { type: 'action', nodeId: button.id, actionName: 'missing' }))
      .rejects
      .toThrow(/不存在名为 'missing'/)
    await result.session.interact('s1', { type: 'action', nodeId: button.id, actionName: 'secondaryAction' })

    expect(result.actions.map(message => message.action.name)).toEqual(['secondary'])
    result.session.dispose()
  })

  it('keeps async action capture isolated across queued interactions', async () => {
    const result = setupSession({
      resolveValue: async (args) => {
        await new Promise(resolve => setTimeout(resolve, Number(args.delay ?? 0)))
        return args.value
      },
    })
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['first', 'second'] },
      {
        id: 'first',
        component: 'Button',
        child: 'firstLabel',
        action: {
          event: {
            name: 'submit',
            context: { result: { '@call': 'resolveValue', 'args': { value: 'first', delay: 20 } } },
          },
        },
      },
      {
        id: 'second',
        component: 'Button',
        child: 'secondLabel',
        action: {
          event: {
            name: 'submit',
            context: { result: { '@call': 'resolveValue', 'args': { value: 'second', delay: 1 } } },
          },
        },
      },
      { id: 'firstLabel', component: 'Text', text: 'First' },
      { id: 'secondLabel', component: 'Text', text: 'Second' },
    ]))

    const first = findNode(rootOf(result), 'first')!
    const second = findNode(rootOf(result), 'second')!
    await Promise.all([
      result.session.interact('s1', { type: 'action', nodeId: first.id }),
      result.session.interact('s1', { type: 'action', nodeId: second.id }),
    ])

    expect(result.actions.map(message => message.action.context.result)).toEqual(['first', 'second'])
    result.session.dispose()
  })

  it('executes a local functionCall action without emitting an agent action', async () => {
    let calls = 0
    const result = setupSession({
      resolveValue: (args) => {
        calls += 1
        return args.value
      },
    })
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['submit'] },
      {
        id: 'submit',
        component: 'Button',
        child: 'submitLabel',
        secondaryAction: { functionCall: { '@call': 'resolveValue', 'args': { value: 'local' } } },
      },
      { id: 'submitLabel', component: 'Text', text: '本地执行' },
    ]))

    const button = findNode(rootOf(result), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id, actionName: 'secondaryAction' })

    expect(calls).toBe(1)
    expect(result.actions).toHaveLength(0)
    result.session.dispose()
  })

  it('forwards unresolved catalog function errors through onError', async () => {
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
    ]))

    const button = findNode(rootOf(result), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(result.actions).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ code: 'EXPRESSION_ERROR', surfaceId: 's1' })
    expect(result.errors[0]!.message).toContain('Function \'resolveValue\'')
    expect(result.errors[0]!.message).toContain('schema-only and has no implementation')
    result.session.dispose()
  })

  it('preserves component nodes nested inside object array slots', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Tabs', tabs: [{ title: 'A', child: 'label' }, { title: 'B', child: 'action' }] },
      { id: 'label', component: 'Text', text: 'Tab A' },
      { id: 'action', component: 'Button', child: 'actionLabel', action: { event: { name: 'nested' } } },
      { id: 'actionLabel', component: 'Text', text: 'Tab B' },
    ]))

    const root = rootOf(result)!
    const tabs = root.props.tabs as Array<{ title: string, child: A2uiNode }>
    expect(root.children).toHaveLength(0)
    expect(tabs.map(tab => tab.title)).toEqual(['A', 'B'])
    expect(tabs[0]!.child).toMatchObject({ componentId: 'label', type: 'Text', props: { text: 'Tab A' } })
    expect(tabs[1]!.child.componentId).toBe('action')

    await result.session.interact('s1', { type: 'action', nodeId: tabs[1]!.child.id })
    expect(result.actions.map(message => message.action.name)).toEqual(['nested'])
    result.session.dispose()
  })

  it('rolls back partial data model mutations when an update fails', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['status', 'target'] },
      { id: 'status', component: 'Text', text: { '@path': '/status' } },
      { id: 'target', component: 'Text', text: { '@path': '/new/foo' } },
    ], { status: 'before' }))

    expect(() => result.session.receive(surfaceMessage('updateDataModel', {
      surfaceId: 's1',
      path: '/new/1/10001/x',
      value: true,
    }))).toThrow()
    expect(findNode(rootOf(result), 'status')?.props.text).toBe('before')
    expect(findNode(rootOf(result), 'target')?.props.text).toBeNull()

    result.session.receive(surfaceMessage('updateDataModel', { surfaceId: 's1', path: '/new/foo', value: 'after' }))
    expect(findNode(rootOf(result), 'target')?.props.text).toBe('after')
    result.session.dispose()
  })

  it('rejects function implementations missing from the catalog', () => {
    expect(() => setupSession({ missing: () => 'unused' })).toThrow(/未声明函数 'missing'/)
  })

  it('treats inherited object members as missing function implementations', async () => {
    const catalog = {
      ...testCatalog,
      functions: {
        ...testCatalog.functions,
        toString: {
          type: 'object',
          returnType: 'string',
          properties: {
            '@call': { const: 'toString' },
            'args': {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            },
          },
          required: ['@call'],
        },
      },
    }
    const result = setupSession(undefined, catalog)
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['submit'] },
      {
        id: 'submit',
        component: 'Button',
        child: 'submitLabel',
        action: {
          event: {
            name: 'submit',
            context: { result: { '@call': 'toString', 'args': { value: 'unused' } } },
          },
        },
      },
      { id: 'submitLabel', component: 'Text', text: '提交' },
    ]))

    const button = findNode(rootOf(result), 'submit')!
    await result.session.interact('s1', { type: 'action', nodeId: button.id })

    expect(result.actions).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.message).toContain('Function \'toString\'')
    expect(result.errors[0]!.message).toContain('schema-only and has no implementation')
    result.session.dispose()
  })
})
