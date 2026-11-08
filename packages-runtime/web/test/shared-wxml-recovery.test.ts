import type { Element } from 'domhandler'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseWxml as parseSharedWxml } from '../src/compiler/wxml/parser'
import { setRuntimeExecutionMode } from '../src/runtime/execution'
import { createTemplate, renderTemplate } from '../src/runtime/legacyTemplate'
import { parseSharedTemplateNodes } from '../src/runtime/legacyTemplate/parser'
import { setRuntimeWarningOptions } from '../src/runtime/warning'
import { parseSharedTemplateDocument } from '../src/shared/templateParser'

afterEach(() => {
  setRuntimeExecutionMode()
  setRuntimeWarningOptions()
  vi.restoreAllMocks()
})

describe('shared Web interpolation recovery', () => {
  it('decodes unrelated legacy attributes normally beside a recovered attribute', () => {
    const source = String.raw`<view title="before\x &amp; after" other="{{ broken( }}" />`
    expect(parseSharedTemplateNodes(source)[0]).toMatchObject({
      attribs: { title: 'beforex & after', other: '{{ broken( }}' },
    })
  })

  it('restores multiple invalid ranges within the same legacy attribute in source order', () => {
    const source = '<view title="{{ first( }} &amp; {{ second( }}" />'
    expect(parseSharedTemplateNodes(source)[0]).toMatchObject({
      attribs: { title: '{{ first( }} & {{ second( }}' },
    })
  })
  it('restores invalid expression text before filtering and keeps original UTF-16 positions', () => {
    const source = '😀<view>{{ adapterText( }}</view><text>tail</text>'
    const compiler = parseSharedWxml(source)
    const legacy = parseSharedTemplateNodes(source)
    expect(compiler).toMatchObject([
      { type: 'text', data: '😀' },
      { name: 'view', startIndex: 2, children: [{ data: '{{ adapterText( }}' }] },
      { name: 'text', startIndex: source.indexOf('<text>') },
    ])
    expect(legacy[1]).toMatchObject({ name: 'view', startIndex: 2, children: [{ data: '{{ adapterText( }}' }] })
    expect(legacy[2]!.startIndex).toBe(source.indexOf('<text>'))
    const parsed = parseSharedTemplateDocument(source)
    expect(parsed.source).toBe(source)
    expect(parsed.document.source.length).toBe(source.length)
    expect(parsed.document.source).not.toBe(source)
    expect(parsed.recoveries[0]).toMatchObject({ kind: 'interpolation', start: source.indexOf('{{'), end: source.indexOf('}}') + 2 })
  })

  it('discovers multiple invalid expressions without altering valid expressions or raw scripts', () => {
    const source = '<view title="{{ first( }} &amp; {{ valid }}">{{ second[ }} {{ valid + 1 }}</view><text>{{ third) }}</text><wxs>const raw = "{{ untouched( }}"</wxs>'
    const nodes = parseSharedWxml(source)
    expect(nodes).toMatchObject([
      { attribs: { title: '{{ first( }} & {{ valid }}' }, children: [{ data: '{{ second[ }} {{ valid + 1 }}' }] },
      { children: [{ data: '{{ third) }}' }] },
      { children: [{ data: 'const raw = "{{ untouched( }}"' }] },
    ])
    expect(parseSharedTemplateDocument(source).recoveries).toHaveLength(3)
  })

  it.each(['xml', 'legacy'] as const)('decodes recovered %s attributes once at the original value boundaries', (syntax) => {
    const source = syntax === 'xml'
      ? '<view title="&amp;amp; {{ &quot;}}&quot; + first( }} &#x1f600;" />'
      : String.raw`<view title="&amp;amp; before\x {{ \"}}\" + first( }} after\y {{ valid }}" />`
    const expected = syntax === 'xml'
      ? '&amp; {{ "}}" + first( }} 😀'
      : '&amp; beforex {{ "}}" + first( }} aftery {{ valid }}'
    expect(parseSharedWxml(source, { syntax })[0]).toMatchObject({ attribs: { title: expected } })
    expect(parseSharedTemplateNodes(source, { syntax })[0]).toMatchObject({ attribs: { title: expected } })
  })

  it('preserves backslash semantics inside valid expressions beside recovered legacy values', () => {
    const source = String.raw`<view title="literal\x {{ \"a\\\\b\" }} {{ invalid( }} {{ \"c\\\\d\" }} tail\y" />`
    expect((parseSharedTemplateNodes(source)[0] as Element).attribs.title)
      .toBe(String.raw`literalx {{ "a\\b" }} {{ invalid( }} {{ "c\\d" }} taily`)
  })

  it('lets the existing safe evaluator suppress and warn once for invalid expressions', () => {
    setRuntimeExecutionMode('safe')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const render = createTemplate('<view>{{ sharedAdapterSafe( }}</view>')
    expect(render({})).toBe('<weapp-view></weapp-view>')
    expect(render({})).toBe('<weapp-view></weapp-view>')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('safe 模式下忽略表达式解析错误')
  })

  it.each(['compat', 'strict'] as const)('keeps %s invalid expression errors at render time', (mode) => {
    setRuntimeExecutionMode(mode)
    let render: ReturnType<typeof createTemplate>
    expect(() => {
      render = createTemplate(`<view>{{ sharedAdapter${mode}( }}</view>`)
    }).not.toThrow()
    expect(() => render!({})).toThrow(SyntaxError)
  })

  it('keeps invalid attribute expressions available to the safe evaluator', () => {
    setRuntimeExecutionMode('safe')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nodes = parseSharedTemplateNodes('<view title="{{ sharedAdapterAttribute( }}">content</view>')
    expect((nodes[0] as Element).attribs.title).toBe('{{ sharedAdapterAttribute( }}')
    expect(renderTemplate(nodes, {})).toBe('<weapp-view>content</weapp-view>')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it.each([
    '<view>{{ first( }}</text>',
    '<view>{{ first( }}</view><text title="unterminated>',
    '<view>{{ first( }}</view><wxs>const value = "unterminated</wxs>',
    '<view>{{ first( }}</view><!--unterminated',
    '<view>{{ first( }}</view><text>{{ second( </text>',
    '<view>{{ "unterminated }}</view>',
    '<view {{ invalid( }} />',
  ])('rejects structural or uncertain boundaries after recovery: %s', (source) => {
    expect(() => parseSharedWxml(source)).toThrow('[web]')
    expect(() => parseSharedTemplateNodes(source)).toThrow('[web]')
    expect(() => createTemplate(source)).toThrow('[web]')
  })
})
