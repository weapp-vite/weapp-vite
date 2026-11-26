import { describe, expect, it } from 'vitest'
import {
  createSurfaceMessage,
  findNode,
  rootOf,
  setupSession,
  surfaceMessage,
} from './sessionTestUtils'

function path(value: string) {
  return { '@path': value }
}

function call(name: string, args: Record<string, unknown>) {
  return { '@call': name, args }
}

describe('A2UI standard functions', () => {
  it('uses built-in string interpolation without a host implementation', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      {
        id: 'root',
        component: 'Text',
        text: call('formatString', { value: `你好，\${/name}` }),
      },
    ], { name: 'Alice' }))

    expect(rootOf(result)?.props.text).toBe('你好，Alice')
    expect(result.errors).toHaveLength(0)
    result.session.dispose()
  })

  it('evaluates validation checks and clears them when checks are removed', async () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['email', 'submit'] },
      {
        'id': 'email',
        'component': 'TextField',
        'label': '邮箱',
        'value': path('/email'),
        '@checks': [
          { condition: call('required', { value: path('/email') }), message: '请填写邮箱' },
          { condition: call('email', { value: path('/email') }), message: '邮箱格式不正确' },
        ],
      },
      {
        'id': 'submit',
        'component': 'Button',
        '@checks': [{
          condition: call('and', {
            values: [
              call('required', { value: path('/email') }),
              call('email', { value: path('/email') }),
            ],
          }),
          message: '请填写有效邮箱',
        }],
      },
    ], { email: 'invalid' }))

    let field = findNode(rootOf(result), 'email')!
    let submit = findNode(rootOf(result), 'submit')!
    expect(field.props).toMatchObject({ isValid: false, validationErrors: ['邮箱格式不正确'] })
    expect(submit.props).toMatchObject({ isValid: false, validationErrors: ['请填写有效邮箱'] })

    await result.session.interact('s1', { type: 'input', nodeId: field.id, value: '' })
    field = findNode(rootOf(result), 'email')!
    expect(field.props).toMatchObject({ isValid: false, validationErrors: ['请填写邮箱', '邮箱格式不正确'] })

    await result.session.interact('s1', { type: 'input', nodeId: field.id, value: 'alice@example.com' })
    field = findNode(rootOf(result), 'email')!
    submit = findNode(rootOf(result), 'submit')!
    expect(field.props).toMatchObject({ isValid: true, validationErrors: [] })
    expect(submit.props).toMatchObject({ isValid: true, validationErrors: [] })

    result.session.receive(surfaceMessage('updateComponents', {
      surfaceId: 's1',
      components: [{
        id: 'email',
        component: 'TextField',
        label: '邮箱',
        value: path('/email'),
      }],
    }))
    field = findNode(rootOf(result), 'email')!
    expect(field.props.isValid).toBeUndefined()
    expect(field.props.validationErrors).toBeUndefined()
    expect(result.errors).toHaveLength(0)
    result.session.dispose()
  })

  it('evaluates length, or, and not with Core validation-result semantics', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['reason', 'submit'] },
      {
        'id': 'reason',
        'component': 'TextField',
        'label': '原因',
        'value': path('/reason'),
        '@checks': [{
          condition: call('length', { value: path('/reason'), min: 4 }),
          message: '至少填写四个字',
        }],
      },
      {
        'id': 'submit',
        'component': 'Button',
        '@checks': [{
          condition: call('and', {
            values: [
              call('or', { values: [path('/primary'), path('/fallback')] }),
              call('not', { value: path('/blocked') }),
            ],
          }),
          message: '当前不能提交',
        }],
      },
    ], { reason: '短', primary: false, fallback: true, blocked: false }))

    expect(findNode(rootOf(result), 'reason')?.props).toMatchObject({
      isValid: false,
      validationErrors: ['至少填写四个字'],
    })
    expect(findNode(rootOf(result), 'submit')?.props).toMatchObject({ isValid: true, validationErrors: [] })

    result.session.receive(surfaceMessage('updateDataModel', {
      surfaceId: 's1',
      path: '/',
      value: { reason: '足够长度', primary: false, fallback: false, blocked: false },
    }))
    expect(findNode(rootOf(result), 'reason')?.props).toMatchObject({ isValid: true, validationErrors: [] })
    expect(findNode(rootOf(result), 'submit')?.props).toMatchObject({
      isValid: false,
      validationErrors: ['当前不能提交'],
    })
    result.session.dispose()
  })

  it('formats nested function calls and template indices', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      {
        id: 'root',
        component: 'Text',
        text: call('formatString', { value: `\${formatString(value:"你好，\${/name}")}` }),
      },
    ], { name: 'Alice' }))
    expect(rootOf(result)?.props.text).toBe('你好，Alice')

    result.session.receive(createSurfaceMessage('s2', [
      { id: 'root', component: 'List', children: { componentId: 'item', path: '/items' } },
      {
        id: 'item',
        component: 'Text',
        text: call('formatString', { value: `\${@index(offset:1)}: \${name}` }),
      },
    ], { items: [{ name: 'A' }, { name: 'B' }] }))
    expect(rootOf(result, 's2')?.children.map(child => child.props.text)).toEqual(['1: A', '2: B'])
    expect(result.errors).toHaveLength(0)
    result.session.dispose()
  })

  it('evaluates regex and numeric validation functions', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['code', 'age'] },
      {
        'id': 'code',
        'component': 'TextField',
        'label': '代码',
        'value': path('/code'),
        '@checks': [{ condition: call('regex', { value: path('/code'), pattern: '^[A-Z]{2}$' }), message: '两位大写字母' }],
      },
      {
        'id': 'age',
        'component': 'TextField',
        'label': '年龄',
        'value': path('/age'),
        '@checks': [{ condition: call('numeric', { value: path('/age'), min: 18 }), message: '至少十八岁' }],
      },
    ], { code: 'AB', age: 12 }))

    expect(findNode(rootOf(result), 'code')?.props).toMatchObject({ isValid: true, validationErrors: [] })
    expect(findNode(rootOf(result), 'age')?.props).toMatchObject({ isValid: false, validationErrors: ['至少十八岁'] })

    result.session.receive(surfaceMessage('updateDataModel', {
      surfaceId: 's1',
      path: '/',
      value: { code: 'a1', age: 20 },
    }))
    expect(findNode(rootOf(result), 'code')?.props).toMatchObject({ isValid: false, validationErrors: ['两位大写字母'] })
    expect(findNode(rootOf(result), 'age')?.props).toMatchObject({ isValid: true, validationErrors: [] })
    result.session.dispose()
  })

  it('lets host implementations override built-in standard functions', () => {
    const result = setupSession({
      required: () => ({ valid: true }),
    })
    result.session.receive(createSurfaceMessage('s1', [
      {
        'id': 'root',
        'component': 'TextField',
        'label': '原因',
        'value': '',
        '@checks': [{ condition: call('required', { value: '' }), message: '必填' }],
      },
    ]))

    expect(rootOf(result)?.props).toMatchObject({ isValid: true, validationErrors: [] })
    result.session.dispose()
  })
})
