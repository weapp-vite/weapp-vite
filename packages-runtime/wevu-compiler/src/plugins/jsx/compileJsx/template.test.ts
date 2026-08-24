import { afterEach, describe, expect, it, vi } from 'vitest'

function hasMissingDefaultExportWarning(warnings: string[], filename: string) {
  return warnings.some(message =>
    message.includes(filename) && message.includes('默认导出组件'),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe.sequential('compileJsx template helpers', () => {
  it('normalizes JavaScript numeric literals for WXML expressions', async () => {
    const { compileJsxTemplate } = await import('./template')
    const result = compileJsxTemplate(
      `export default { render() { return <view data-binary={0b1010_0001_1000_0101} data-octal={0o2_2_5_6} data-hex={0xA0_B0_C0} data-bigint={1_000_000_000_000_000_000_000n}>{1_050.95}</view> } }`,
      '/project/src/pages/issue-852/index.tsx',
    )

    expect(result.template).toContain('data-binary="{{41349}}"')
    expect(result.template).toContain('data-octal="{{1198}}"')
    expect(result.template).toContain('data-hex="{{10531008}}"')
    expect(result.template).toContain(`data-bigint="{{'1000000000000000000000'}}"`)
    expect(result.template).toContain('>{{1050.95}}</view>')
    expect(result.template).not.toMatch(/(?:\d_\d|0[bxo]|\d+n\b)/i)
  })

  it('extracts a render closure returned from setup', async () => {
    const { compileJsxTemplate } = await import('./template')
    const result = compileJsxTemplate(
      `export default { setup() { return () => <view><text>setup render</text></view> } }`,
      '/project/src/setup.tsx',
    )

    expect(result.template).toBe('<view><text>setup render</text></view>')
    expect(result.warnings).toEqual([])
  })

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
    expect(customContext.formatWxml).toBe(false)
  })

  it('formats compiled jsx templates when template formatWxml is enabled', async () => {
    const { compileJsxTemplate } = await import('./template')
    const result = compileJsxTemplate(
      'export default { render() { return <view><view /></view> } }',
      '/project/src/pages/index/index.tsx',
      {
        template: {
          formatWxml: true,
        },
      },
    )

    expect(result.template).toBe([
      '<view>',
      '  <view />',
      '</view>',
      '',
    ].join('\n'))
  })

  it('rewrites missing default-export warning with filename', async () => {
    const analysis = await import('./analysis')
    vi.spyOn(analysis, 'analyzeJsxAst').mockImplementation((_ast: any, context: any) => {
      context.warnings.push('未识别到默认导出组件。')
      return {
        renderExpression: null,
        autoComponentContext: {
          templateTags: new Set<string>(),
          importedComponents: [],
        },
      }
    })
    const { compileJsxTemplate } = await import('./template')
    const result = compileJsxTemplate('export default {}', '/project/src/pages/jsx/missing-default.tsx')

    expect(result.template).toBeUndefined()
    expect(hasMissingDefaultExportWarning(result.warnings, '/project/src/pages/jsx/missing-default.tsx')).toBe(true)
  })

  it('rewrites missing default-export warning when collecting components', async () => {
    const analysis = await import('./analysis')
    vi.spyOn(analysis, 'analyzeJsxAst').mockImplementation((_ast: any, context: any) => {
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

  it('accepts astEngine on auto-component collection without changing current behavior', async () => {
    const { collectJsxAutoComponents } = await import('./template')
    const source = `
import TButton from '@/components/TButton'

export default {
  render() {
    return <TButton />
  },
}
    `

    expect(collectJsxAutoComponents(source, '/project/src/pages/jsx/a.tsx', { astEngine: 'babel' })).toEqual(
      collectJsxAutoComponents(source, '/project/src/pages/jsx/a.tsx', { astEngine: 'oxc' }),
    )
  })
})
