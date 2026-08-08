import { describe, expect, it } from 'vitest'
import { compileStaticReactPage } from './index'

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
    expect(result.template).toContain('<button id="increment" bindtap="__weapp_vite_react_event" data-sid="s2">increment</button>')
    expect(result.template).toContain('<input id="name" value="{{slots.s3.value}}" bindinput="__weapp_vite_react_event" data-sid="s3" />')
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

  it('compiles native component props, events and default slots', () => {
    const result = compileStaticReactPage(`
      import { createNativeComponent as bridge, Slot, Text, View } from '@weapp-vite/react'
      const NativeCard = bridge('native-card')
      function formatLabel(value) {
        return String(value)
      }
      export function InteropView({ label, onChange }) {
        return (
          <View>
            <NativeCard data-e2e-result={label} label={label} onValueChange={onChange}>
              <Text>projected</Text>
            </NativeCard>
            <NativeCard onChange={onChange} onValueChangeCapture={onChange} />
            <Slot />
          </View>
        )
      }
    `, 'interop.tsx')

    expect(result.nativeComponents).toEqual(['native-card'])
    expect(result.template).toContain('<native-card data-e2e-result="{{slots.s1[\'data-e2e-result\']}}" label="{{slots.s1.label}}" bind:value-change="__weapp_vite_react_event" data-sid="s1">')
    expect(result.template).toContain('<native-card bind:change="__weapp_vite_react_event" capture-bind:value-change="__weapp_vite_react_event" data-sid="s3" />')
    expect(result.template).toContain('<text>projected</text>')
    expect(result.template).toContain('<slot />')
    expect(result.code).toContain('__bindingFields="data-e2e-result,label"')
  })

  it('does not let bridge files fall back when no static component can be selected', () => {
    expect(() => compileStaticReactPage(`
      import { createNativeComponent } from '@weapp-vite/react'
      const NativeCard = createNativeComponent('native-card')
      export const InteropView = () => <NativeCard />
    `, 'interop-arrow.tsx')).toThrow('原生组件 bridge，组件结构必须可静态分析')
  })

  it('rejects dynamic structures when a native component bridge is declared', () => {
    expect(() => compileStaticReactPage(`
      import { createNativeComponent, View } from '@weapp-vite/react'
      const NativeCard = createNativeComponent('native-card')
      export function InteropView({ visible }) {
        return <View>{visible && <NativeCard />}</View>
      }
    `, 'interop-dynamic.tsx')).toThrow('原生组件 bridge，组件结构必须可静态分析')
  })
})
