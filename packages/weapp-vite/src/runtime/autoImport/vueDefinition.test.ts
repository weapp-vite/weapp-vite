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
    expect(code).toContain('DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin')
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
    expect(code).toContain('VanInfo: typeof import(\"@vant/weapp/lib/info/index.js\") & WeappComponent<ComponentProp<\"van-info\">>;')
  })
})
