import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml/compile'
import { parseWxml } from '../src/compiler/wxml/parser'
import { collectUnknownTags, formatUnknownTagWarning } from '../src/compiler/wxml/unknownTags'

function tagsOf(source: string, componentTags?: Record<string, string>) {
  return collectUnknownTags(parseWxml(source), componentTags)
}

function warningsOf(source: string, componentTags?: Record<string, string>) {
  const compiled = compileWxml({
    id: '/fake/page.wxml',
    source,
    resolveTemplatePath: (name: string) => `/fake/${name}.wxml`,
    resolveWxsPath: (name: string) => `/fake/${name}.wxs`,
    componentTags,
  })
  return compiled.warnings ?? []
}

describe('collectUnknownTags', () => {
  it('accepts builtin and html tags', () => {
    expect(tagsOf('<view><text>hi</text><image src="x" /><div><span>y</span></div></view>')).toEqual([])
  })

  it('accepts HTML, SVG and MathML descendants', () => {
    expect(tagsOf('<details><summary>more</summary><dialog /><svg><defs /><path /><circle /><foreignObject /></svg><math><mrow><mi>x</mi></mrow></math></details>')).toEqual([])
  })

  it('accepts every component in the official repository metadata', () => {
    const definitions: unknown = JSON.parse(readFileSync(new URL('../../wevu/components.weapp.json', import.meta.url), 'utf8'))
    if (!Array.isArray(definitions)) {
      throw new TypeError('Invalid native component metadata')
    }
    const source = definitions.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || !('name' in entry) || typeof entry.name !== 'string') {
        throw new TypeError('Invalid native component name')
      }
      return `<${entry.name} />`
    }).join('')
    expect(tagsOf(source)).toEqual([])
  })

  it('accepts registered custom components', () => {
    expect(tagsOf('<my-card />', { 'my-card': 'my-card' })).toEqual([])
  })

  it('flags a misspelled builtin tag', () => {
    expect(tagsOf('<buton>提交</buton>')).toEqual(['buton'])
  })

  it('flags an unregistered custom component', () => {
    expect(tagsOf('<order-card />')).toEqual(['order-card'])
  })

  it('flags tags nested inside other elements', () => {
    expect(tagsOf('<view><scroll-vie><text>x</text></scroll-vie></view>')).toEqual(['scroll-vie'])
  })

  it('does not flag native components that web does not implement', () => {
    expect(tagsOf('<web-view src="https://example.com" />')).toEqual([])
    expect(tagsOf('<map />')).toEqual([])
  })

  it('deduplicates repeated unknown tags', () => {
    expect(tagsOf('<buton /><buton /><buton />')).toEqual(['buton'])
  })
})

describe('unknown tag warnings', () => {
  it('reports unknown tags through compile warnings', () => {
    const warnings = warningsOf('<view><buton>提交</buton></view>')
    expect(warnings.some(warning => warning.includes('<buton>'))).toBe(true)
  })

  it('emits nothing for a valid template', () => {
    expect(warningsOf('<view><text>ok</text></view>')).toEqual([])
  })

  it('does not diagnose the compiler-injected navigation bar', () => {
    const compiled = compileWxml({
      id: 'pages/home/index.wxml',
      source: '<view>ok</view>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
      navigationBar: { config: { title: 'Home' } },
    })
    expect(compiled.code).toContain('weapp-navigation-bar')
    expect(compiled.warnings ?? []).toEqual([])
  })

  it('reports each dependency once and retains its registered component scope', () => {
    const root = mkdtempSync(join(tmpdir(), 'web-unknown-tags-'))
    try {
      writeFileSync(join(root, 'part.wxml'), '<buton /><buton />')
      writeFileSync(join(root, 'card.wxml'), '<template name="card"><order-card /><my-card /></template>')
      const compiled = compileWxml({
        id: join(root, 'index.wxml'),
        source: '<include src="./part.wxml" /><include src="./part.wxml" /><import src="./card.wxml" />',
        resolveTemplatePath: raw => resolve(root, raw),
        resolveWxsPath: () => undefined,
        componentTags: { 'my-card': 'registered-card' },
      })
      expect(compiled.warnings).toHaveLength(2)
      expect(compiled.warnings?.filter(warning => warning.includes('<buton>'))).toHaveLength(1)
      expect(compiled.warnings?.filter(warning => warning.includes('<order-card>'))).toHaveLength(1)
      expect(compiled.warnings?.some(warning => warning.includes('<my-card>'))).toBe(false)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('formats a readable message with the file name', () => {
    const message = formatUnknownTagWarning(['buton', 'order-card'], '/pages/order.wxml')
    expect(message).toContain('/pages/order.wxml')
    expect(message).toContain('<buton>')
    expect(message).toContain('<order-card>')
    expect(message).toContain('usingComponents')
  })
})
