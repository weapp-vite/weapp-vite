import { describe, expect, it, vi } from 'vitest'
import {
  resolveBabelTraverse,
  transformScriptModule,
} from '../src/plugin/register'

function createMeta(kind: 'app' | 'page' | 'component') {
  return {
    id: kind === 'app' ? 'app' : `${kind}/demo`,
    kind,
    scriptPath: `/src/${kind}.ts`,
  }
}

describe('web script registration transform contract', () => {
  it('resolves supported Babel traverse module shapes', () => {
    const direct = vi.fn()
    const defaultExport = vi.fn()
    const namedExport = vi.fn()

    expect(resolveBabelTraverse(direct)).toBe(direct)
    expect(resolveBabelTraverse({ default: defaultExport })).toBe(defaultExport)
    expect(resolveBabelTraverse({ traverse: namedExport })).toBe(namedExport)
    expect(() => resolveBabelTraverse({ default: 1, traverse: 2 })).toThrow('Failed to resolve')
  })

  it('returns null for scripts that cannot be parsed', () => {
    expect(transformScriptModule({
      cleanId: '/src/broken.ts',
      code: 'const value = `unterminated',
      enableHmr: false,
      meta: createMeta('page'),
    })).toBeNull()
  })

  it('maps page factories and ignores unrelated or member calls', () => {
    const result = transformScriptModule({
      cleanId: '/src/page.ts',
      code: 'Page({}); Component({}); App({}); factory({}); runtime.Page({})',
      enableHmr: false,
      meta: createMeta('page'),
      runtimeModuleId: 'virtual:web-runtime',
    })!

    expect(result.code).toContain('registerPage({}, { id: "page/demo" })')
    expect(result.code).toContain('App({})')
    expect(result.code).toContain('factory({})')
    expect(result.code).toContain('runtime.Page({})')
    expect(result.code).not.toContain('hot.accept')
  })

  it('adds template, inline style, navigation, public wevu factory, and HMR metadata', () => {
    const result = transformScriptModule({
      cleanId: '/src/components/card.ts',
      code: 'import wevuDefault, { defineComponent as defineCard, ref } from \'wevu\'; void wevuDefault; void ref; defineCard({})',
      enableHmr: true,
      hmrAcceptCode: 'import.meta.hot.accept()',
      meta: {
        ...createMeta('component'),
        navigationBar: { title: 'Card' },
        stylePath: '/src/components/card.scss',
        templatePath: '/src/components/card.wxml',
      },
    })!

    expect(result.code).toContain('installWebModuleRegistration')
    expect(result.code).toContain('defineCard({})')
    expect(result.code).not.toContain('registerWebWevuComponent')
    expect(result.code).toContain('card.scss?inline')
    expect(result.code).toContain('card.wxml?weapp-web-template')
    expect(result.code).toContain('navigationBar: {"title":"Card"}')
    expect(result.code).toContain('kind: "component"')
    expect(result.code).toContain('import.meta.hot.accept()')
  })

  it('maps native component and app factories without treating app defineComponent as a component', () => {
    const component = transformScriptModule({
      cleanId: '/src/component.ts',
      code: 'Component({})',
      enableHmr: true,
      meta: {
        ...createMeta('component'),
        stylePath: '/src/component.wxss',
      },
    })!
    expect(component.code).toContain('registerComponent({}')
    expect(component.code).toContain('component.wxss?weapp-web-style')

    const app = transformScriptModule({
      cleanId: '/src/app.ts',
      code: 'import { defineComponent } from \'wevu\'; defineComponent({}); App({})',
      enableHmr: true,
      meta: createMeta('app'),
    })!
    expect(app.code).toContain('defineComponent({})')
    expect(app.code).toContain('registerApp({}, { id: "app" })')
  })
})
