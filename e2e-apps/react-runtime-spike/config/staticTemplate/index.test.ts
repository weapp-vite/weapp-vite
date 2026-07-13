import { describe, expect, it } from 'vitest'
import { compileStaticReactPage } from './index.ts'

const source = `
import { useState } from 'react'
import { Button, Input, Text, View } from '../../runtime/components'

export function ReactStaticPage() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('React')
  return (
    <View className={\`page count-\${count}\`} style={{ padding: 16 }}>
      <Text id="count">{\`count:\${count}\`}</Text>
      <Button id="increment" onTap={() => setCount(value => value + 1)}>increment</Button>
      <Input id="name" value={name} onInput={event => setName(String(event.detail.value))} />
    </View>
  )
}
`

describe('static React template compiler', () => {
  it('emits native WXML and injects runtime binding slots', () => {
    const result = compileStaticReactPage(source, 'static.tsx')

    expect(result.template).toContain('<view class="{{slots.s0.className}}" style="padding:16px">')
    expect(result.template).toContain('<text id="count">{{slots.s1.text}}</text>')
    expect(result.template).toContain('<button id="increment" bindtap="eh" data-sid="s2">increment</button>')
    expect(result.template).toContain('<input id="name" value="{{slots.s3.value}}" bindinput="eh" data-sid="s3" />')
    expect(result.template).not.toContain('react_node_')
    expect(result.code).toContain('__slot="s0"')
    expect(result.code).toContain('__bindingFields="className"')
    expect(result.slots).toEqual([
      { bindings: ['className'], id: 's0', tag: 'view' },
      { bindings: ['text'], id: 's1', tag: 'text' },
      { bindings: [], id: 's2', tag: 'button' },
      { bindings: ['value'], id: 's3', tag: 'input' },
    ])
  })

  it('fails unsupported dynamic structures explicitly', () => {
    expect(() => compileStaticReactPage(`
      import { Text, View } from '../../runtime/components'
      export function ReactStaticPage({ visible }) {
        return <View>{visible && <Text>visible</Text>}</View>
      }
    `, 'dynamic.tsx')).toThrow('暂不支持动态结构表达式')
  })
})
