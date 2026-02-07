import { describe, expect, it } from 'vitest'
import { createVueComponentsDefinition } from './vueDefinition'

describe('createVueComponentsDefinition', () => {
  it('inlines props when typed-components reuse is disabled', () => {
    const code = createVueComponentsDefinition(
      ['t-avatar'],
      () => ({ types: new Map([['size', 'string']]), docs: new Map() }),
      { useTypedComponents: false },
    )
    expect(code).toContain('import type { ComponentOptionsMixin, DefineComponent, PublicProps } from \'wevu\'')
    expect(code).not.toContain('weapp-vite/typed-components')
    expect(code).toContain('readonly size?: string;')
    expect(code).toContain('InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin')
    expect(code).not.toContain('@ts-nocheck')
  })

  it('references weapp-vite/typed-components when enabled', () => {
    const code = createVueComponentsDefinition(
      ['t-avatar', 'van-button'],
      () => ({ types: new Map([['size', 'string']]), docs: new Map() }),
      { useTypedComponents: true },
    )
    expect(code).toContain('declare module \'vue\'')
    expect(code).toContain('import type { ComponentProp } from \'weapp-vite/typed-components\'')
    expect(code).toContain('TAvatar: WeappComponent<ComponentProp<\"t-avatar\">>;')
    expect(code).toContain('\'t-avatar\': WeappComponent<ComponentProp<\"t-avatar\">>;')
    expect(code).toContain('VanButton: WeappComponent<ComponentProp<\"van-button\">>;')
    expect(code).toContain('\'van-button\': WeappComponent<ComponentProp<\"van-button\">>;')
    expect(code).not.toContain('readonly size?: string;')
    expect(code).not.toContain('[component: string]: WeappComponent;')
  })

  it('uses custom module name when provided', () => {
    const code = createVueComponentsDefinition(
      ['t-empty'],
      () => ({ types: new Map(), docs: new Map() }),
      { useTypedComponents: true, moduleName: 'wevu' },
    )
    expect(code).toContain('declare module \'wevu\'')
  })

  it('adds source import types for navigation when provided', () => {
    const code = createVueComponentsDefinition(
      ['van-info'],
      () => ({ types: new Map(), docs: new Map() }),
      {
        useTypedComponents: true,
        resolveComponentImport: () => '@vant/weapp/lib/info/index.js',
      },
    )
    expect(code).toContain('VanInfo: __WeappComponentImport<typeof import(\"@vant/weapp/lib/info/index.js\"), WeappComponent<ComponentProp<\"van-info\">>>;')
    expect(code).toContain('type __WeappComponentImport<TModule, Fallback = {}> = 0 extends 1 & TModule ? Fallback : TModule extends { default: infer Component } ? Component & Fallback : Fallback')
  })

  it('adds index signature when component list is empty', () => {
    const code = createVueComponentsDefinition(
      [],
      () => ({ types: new Map(), docs: new Map() }),
      { useTypedComponents: true },
    )
    expect(code).toContain('[component: string]: WeappComponent;')
  })
})
