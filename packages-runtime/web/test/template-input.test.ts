import type { TemplateInputOptions } from '../src/shared/templateInput'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml/compile'
import { parseWxml } from '../src/compiler/wxml/parser'
import { weappWebPlugin } from '../src/plugin'
import { TEMPLATE_EXTS } from '../src/plugin/constants'
import { createTemplate } from '../src/runtime/legacyTemplate'
import { resolveTemplateInput } from '../src/shared/templateInput'
import { appendTemplateInputQuery, readTemplateInputQuery } from '../src/shared/templateInputQuery'

const nativeOverrides: readonly (TemplateInputOptions | undefined)[] = [undefined, { syntax: 'xml' }, { platform: 'weapp' }]

async function withFixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'web-template-input-'))
  try {
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src/app.js'), 'App({})')
    await writeFile(join(root, 'src/app.json'), '{"pages":[]}')
    await run(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('Web template input profiles', () => {
  it.each([
    ['wxml', 'weapp', 'legacy'],
    ['axml', 'alipay', 'xml'],
    ['swan', 'swan', 'xml'],
    ['ttml', 'tt', 'xml'],
    ['jxml', 'jd', 'xml'],
    ['xhsml', 'xhs', 'xml'],
    ['qml', 'qq', 'xml'],
    ['ksml', 'ks', 'xml'],
    ['html', undefined, 'xml'],
  ] as const)('recognizes native .%s input independently of the Web target', (extension, platform, syntax) => {
    expect(TEMPLATE_EXTS).toContain(`.${extension}`)
    expect(resolveTemplateInput(`src/page.${extension.toUpperCase()}?query`)).toMatchObject({ platform, syntax })
  })

  it('uses actual dependency extensions before fallback and explicit overrides before both', () => {
    const inherited = { platform: 'tt', syntax: 'xml', rawTags: ['custom-script'] } as const
    expect(resolveTemplateInput('part.fragment', {}, inherited)).toEqual(inherited)
    expect(resolveTemplateInput('part.wxml', {}, inherited)).toEqual({ platform: 'weapp', syntax: 'legacy', rawTags: undefined })
    expect(resolveTemplateInput('part.axml', { platform: 'weapp' }, inherited).syntax).toBe('legacy')
    expect(resolveTemplateInput('part.wxml', { platform: 'weapp', syntax: 'xml' }, inherited).syntax).toBe('xml')
    expect(resolveTemplateInput(String.raw`C:\project\page.qml`)).toMatchObject({ platform: 'qq', syntax: 'xml' })
  })

  it('preserves unquoted backslashes and keys the public runtime cache by input profile', () => {
    const source = String.raw`<view title="a\b" />`
    expect(parseWxml(source)[0]).toMatchObject({ attribs: { title: String.raw`a\b` } })
    expect(createTemplate(source)()).toContain('title="ab"')
    expect(createTemplate(source, { syntax: 'xml' })()).toContain(String.raw`title="a\b"`)
    expect(createTemplate(source, { platform: 'tt' })()).toContain(String.raw`title="a\b"`)
    const unquoted = String.raw`<view title=a\&amp;b />`
    expect(parseWxml(unquoted, { platform: 'weapp' })[0]).toMatchObject({ attribs: { title: String.raw`a\&b` } })
    expect(createTemplate(unquoted)()).toContain(String.raw`title="a\&amp;b"`)
    const markup = '<filter><view /></filter>'
    expect(createTemplate(markup)()).toContain('<weapp-view>')
    expect(createTemplate(markup, { rawTags: ['filter'] })()).toContain('&lt;view /&gt;')
  })

  it('round-trips only nondefault dependency profiles and rejects malformed queries', () => {
    const request = './part.wxml?weapp-web-template'
    expect(appendTemplateInputQuery(request, resolveTemplateInput(request))).toBe(request)
    const input: TemplateInputOptions = { platform: 'tt', syntax: 'xml', rawTags: ['a\'b'] }
    const queried = appendTemplateInputQuery(request, input)
    expect(queried).not.toContain('a\'b')
    expect(readTemplateInputQuery(queried)).toEqual(input)
    expect(readTemplateInputQuery(request)).toBeUndefined()
    for (const value of ['{', '[]', '{"platform":"web"}', '{"syntax":"html"}', '{"rawTags":[1]}']) {
      expect(() => readTemplateInputQuery(`${request}&weapp-web-input=${encodeURIComponent(value)}`)).toThrow('[web]')
    }
  })

  it('propagates recursive unknown-extension inputs while known dependencies reselect their own profile', async () => {
    await withFixture(async (root) => {
      const filename = join(root, 'src/page.ttml')
      const part = join(root, 'src/part.fragment')
      const nested = join(root, 'src/nested.wxml')
      await writeFile(part, '<include src="./nested.wxml" /><sjs>const tag = "<hidden-card />"</sjs><part-typo />')
      await writeFile(nested, '<wxs>const tag = "<hidden-card />"</wxs><nested-typo />')
      const result = compileWxml({
        id: filename,
        source: '<include src="./part.fragment" />',
        resolveTemplatePath: (raw, importer) => resolve(dirname(importer), raw),
        resolveWxsPath: () => undefined,
      })
      expect(result.warnings).toBeUndefined()
      expect(result.dependencies).toEqual([part, nested])
      expect(result.tagDiagnostics?.map(diagnostic => diagnostic.tag)).toEqual(['sjs', 'part-typo', 'nested-typo'])
      const request = result.code.match(/from '([^']+part\.fragment[^']+)'/)?.[1]
      expect(request).toBeDefined()
      expect(readTemplateInputQuery(request!)).toMatchObject({ platform: 'tt', syntax: 'xml' })
      const plugin = weappWebPlugin()
      await plugin.configResolved!.call({}, { root, command: 'build' })
      const compiled = await plugin.load!.call({}, `${part}${request!.slice(request!.indexOf('?'))}`)
      expect(compiled).toContain('from \'./nested.wxml?weapp-web-template\'')
    })
  })

  it('uses the same legacy profile for layout-wrapped source and original diagnostics', () => {
    const original = String.raw`<view title="a\"b"><source-typo /></view>`
    const result = compileWxml({
      id: 'pages/index.wxml',
      source: `<layout-wrapper>${original}</layout-wrapper>`,
      diagnosticSource: original,
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.code).toContain(JSON.stringify('a"b'))
    expect(result.tagDiagnostics).toEqual([{ tag: 'source-typo', reason: 'unknown', filename: 'pages/index.wxml', line: 1, column: original.indexOf('<source-typo') + 1 }])
  })

  it('analyzes a shared unknown-extension file for every actual input profile', async () => {
    await withFixture(async (root) => {
      const filename = join(root, 'src/page.wxml')
      const shared = join(root, 'src/shared.fragment')
      await writeFile(join(root, 'src/ali.axml'), '<include src="./shared.fragment" />')
      await writeFile(join(root, 'src/wx.wxml'), '<include src="./shared.fragment" />')
      await writeFile(shared, '<import-sjs>"<dialect-only />"</import-sjs>')
      const result = compileWxml({
        id: filename,
        source: '<include src="./ali.axml" /><include src="./wx.wxml" />',
        resolveTemplatePath: (raw, importer) => resolve(dirname(importer), raw),
        resolveWxsPath: () => undefined,
      })
      expect(result.warnings).toBeUndefined()
      expect(result.tagDiagnostics).toContainEqual(expect.objectContaining({ tag: 'dialect-only', filename: shared }))
      expect(result.dependencies.filter(dependency => dependency === shared)).toHaveLength(1)
    })
  })

  it('does not report a cycle when a second profile makes the apparent back edge raw script text', async () => {
    await withFixture(async (root) => {
      const shared = join(root, 'src/shared.fragment')
      const ali = join(root, 'src/ali.axml')
      await writeFile(shared, '<import-sjs>"<include src=\'./ali.axml\' />"</import-sjs>')
      await writeFile(ali, '<include src="./shared.fragment" />')
      const result = compileWxml({
        id: join(root, 'src/page.wxml'),
        source: '<include src="./shared.fragment" />',
        resolveTemplatePath: (raw, importer) => resolve(dirname(importer), raw),
        resolveWxsPath: () => undefined,
      })
      expect(result.warnings).toBeUndefined()
      expect(result.dependencies).toEqual([shared, ali])
    })
  })

  it('uses native profiles in both plugin entrances and allows an explicit native override', async () => {
    await withFixture(async (root) => {
      const source = String.raw`<view title="a\b" />`
      for (const input of [undefined, { syntax: 'xml' } as const]) {
        const plugin = weappWebPlugin({ templateInput: input })
        await plugin.configResolved!.call({}, { root, command: 'build' })
        for (const extension of ['wxml', 'jxml', 'qml', 'ksml']) {
          const filename = join(root, `src/part.${extension}`)
          await writeFile(filename, source)
          const expected = extension === 'wxml' && !input ? 'ab' : String.raw`a\b`
          const transformed = await plugin.transform!.call({ warn: vi.fn() }, source, filename)
          expect(transformed?.code).toContain(JSON.stringify(expected))
          expect(await plugin.load!.call({}, `${filename}?weapp-web-template`)).toContain(JSON.stringify(expected))
        }
      }
    })
  })

  it.each(nativeOverrides)('reads real SFC lowering as XML while native dependencies use override %j', async (input) => {
    await withFixture(async (root) => {
      const filename = join(root, 'src/card.vue')
      const native = join(root, 'src/part.wxml')
      const source = String.raw`<template><view title="a\b" /><include src="./part.wxml" /></template>`
      await writeFile(filename, source)
      await writeFile(native, String.raw`<view title="c\d" />`)
      const plugin = weappWebPlugin({ templateInput: input })
      await plugin.configResolved!.call({}, { root, command: 'build' })
      await plugin.transform!.call({}, source, filename)
      const code = await plugin.load!.call({}, `${filename}?weapp-web-sfc-template`)
      expect(code).toContain(JSON.stringify(String.raw`a\b`))
      const request = code!.match(/from '([^']+part\.wxml[^']+)'/)?.[1]
      const expected = input?.syntax === 'xml' ? String.raw`c\d` : 'cd'
      if (input?.syntax === 'xml') {
        expect(readTemplateInputQuery(request!)).toMatchObject({ platform: 'weapp', syntax: 'xml' })
      }
      else {
        expect(readTemplateInputQuery(request!)).toBeUndefined()
      }
      expect(await plugin.load!.call({}, `${native}${request!.slice(request!.indexOf('?'))}`)).toContain(JSON.stringify(expected))
    })
  })

  it('treats an external SFC template as generated XML and the same native file as legacy', async () => {
    await withFixture(async (root) => {
      const filename = join(root, 'src/external.vue')
      const template = join(root, 'src/content.wxml')
      const source = '<template src="./content.wxml"></template>'
      await writeFile(filename, source)
      await writeFile(template, String.raw`<view title="e\f" />`)
      const plugin = weappWebPlugin()
      await plugin.configResolved!.call({}, { root, command: 'build' })
      await plugin.transform!.call({}, source, filename)
      expect(await plugin.load!.call({}, `${filename}?weapp-web-sfc-template`)).toContain(JSON.stringify(String.raw`e\f`))
      expect(await plugin.load!.call({}, `${template}?weapp-web-template`)).toContain(JSON.stringify('ef'))
    })
  })
})
