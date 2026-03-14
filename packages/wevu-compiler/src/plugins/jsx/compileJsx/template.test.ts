import { afterEach, describe, expect, it, vi } from 'vitest'

function hasMissingDefaultExportWarning(warnings: string[], filename: string) {
  return warnings.some(message =>
    message.includes(filename) && message.includes('默认导出组件'),
  )
}

afterEach(() => {
  vi.doUnmock('./analysis')
  vi.resetModules()
})

describe('compileJsx template helpers', () => {
  it('creates compile context from defaults and template overrides', async () => {
    const { createJsxCompileContext } = await import('./template')
    const defaultContext = createJsxCompileContext()
    expect(defaultContext.mustacheInterpolation).toBe('compact')
    expect(defaultContext.inlineExpressions).toEqual([])

    const customContext = createJsxCompileContext({
      template: {
        mustacheInterpolation: 'spaced',
      },
    } as any)
    expect(customContext.mustacheInterpolation).toBe('spaced')
  })

  it('rewrites missing default-export warning with filename', async () => {
    vi.resetModules()
    vi.doMock('./analysis', async () => {
      const actual = await vi.importActual<typeof import('./analysis')>('./analysis')
      return {
        ...actual,
        analyzeJsxAst: (_ast: any, context: any) => {
          context.warnings.push('未识别到默认导出组件。')
          return {
            renderExpression: null,
            autoComponentContext: {
              templateTags: new Set<string>(),
              importedComponents: [],
            },
          }
        },
      }
    })
    const { compileJsxTemplate } = await import('./template')
    const result = compileJsxTemplate('export default {}', '/project/src/pages/jsx/missing-default.tsx')

    expect(result.template).toBeUndefined()
    expect(hasMissingDefaultExportWarning(result.warnings, '/project/src/pages/jsx/missing-default.tsx')).toBe(true)
  })

  it('rewrites missing default-export warning when collecting components', async () => {
    vi.resetModules()
    vi.doMock('./analysis', async () => {
      const actual = await vi.importActual<typeof import('./analysis')>('./analysis')
      return {
        ...actual,
        analyzeJsxAst: (_ast: any, context: any) => {
          context.warnings.push('未识别到默认导出组件。')
          return {
            renderExpression: null,
            autoComponentContext: {
              templateTags: new Set<string>(),
              importedComponents: [{
                localName: 'TButton',
                importSource: '@/components/TButton',
                importedName: 'default',
                kind: 'default',
              }],
            },
          }
        },
      }
    })
    const { compileJsxTemplateAndCollectComponents } = await import('./template')
    const result = compileJsxTemplateAndCollectComponents(`
import TButton from '@/components/TButton'
export default {}
    `, '/project/src/pages/jsx/no-default.tsx')

    expect(result.template).toBeUndefined()
    expect(hasMissingDefaultExportWarning(result.warnings, '/project/src/pages/jsx/no-default.tsx')).toBe(true)
    expect(result.autoComponentContext.importedComponents).toEqual([{
      localName: 'TButton',
      importSource: '@/components/TButton',
      importedName: 'default',
      kind: 'default',
    }])
    expect([...result.autoComponentContext.templateTags]).toEqual([])
  })

  it('collects non-builtin JSX tags from nested expressions and fragments', async () => {
    const { collectJsxAutoComponents } = await import('./template')
    const result = collectJsxAutoComponents(`
import TButton from '@/components/TButton'

export default {
  render() {
    return <>
      <view />
      {ok ? <TButton /> : <t-card />}
      {list.map(item => <FooCell key={item.id} />)}
      <component is="dynamic" />
    </>
  },
}
    `, '/project/src/pages/jsx/auto-components.tsx')

    expect([...result.templateTags]).toEqual(['TButton', 't-card', 'FooCell'])
    expect(result.importedComponents[0]).toEqual({
      localName: 'TButton',
      importSource: '@/components/TButton',
      importedName: 'default',
      kind: 'default',
    })
  })
})
