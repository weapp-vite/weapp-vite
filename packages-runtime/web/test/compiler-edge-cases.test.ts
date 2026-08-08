import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildExpression,
  buildTemplateDataExpression,
  parseInterpolations,
} from '../src/compiler/wxml/interpolation'
import {
  buildNavigationBarAttrs,
  extractNavigationBarFromPageMeta,
} from '../src/compiler/wxml/navigation'
import {
  collectSpecialNodes,
  normalizeTemplatePath,
  shouldMarkWxsImport,
  toRelativeImport as toTemplateRelativeImport,
} from '../src/compiler/wxml/specialNodes'
import {
  isRecord,
  readJsonFile,
  resolveJsonPath,
  resolveScriptFile,
  resolveStyleFile,
  resolveTemplateFile,
} from '../src/plugin/files'
import {
  appendInlineQuery,
  appendQuery,
  cleanUrl,
  isHtmlEntry,
  isInsideDir,
  normalizePath,
  relativeModuleId,
  resolveFileWithExtensionsSync,
  resolveImportBase,
  resolveRuntimePolyfillPath,
  resolveTemplatePathSync,
  resolveWxsPathSync,
  toPosixId,
  toRelativeImport,
  toViteFsImport,
} from '../src/plugin/path'

describe('compiler and plugin edge cases', () => {
  it('parses text, empty, incomplete and mixed interpolations', () => {
    expect(parseInterpolations('plain')).toEqual([{ type: 'text', value: 'plain' }])
    expect(parseInterpolations('before {{ value }} after')).toEqual([
      { type: 'text', value: 'before ' },
      { type: 'expr', value: 'value' },
      { type: 'text', value: ' after' },
    ])
    expect(parseInterpolations('{{ }}tail')).toEqual([{ type: 'text', value: 'tail' }])
    expect(parseInterpolations('before {{ value')).toEqual([
      { type: 'text', value: 'before ' },
      { type: 'text', value: '{{ value' },
    ])
    expect(parseInterpolations('')).toEqual([{ type: 'text', value: '' }])
    expect(buildExpression([], 'scope', 'wxs')).toBe('""')
    expect(buildExpression([{ type: 'text', value: 'a' }], 'scope', 'wxs')).toBe('"a"')
    expect(buildExpression([{ type: 'expr', value: 'a' }], 'scope', 'wxs')).toBe('ctx.eval("a", scope, wxs)')
    expect(buildExpression(parseInterpolations('a{{b}}c'), 'scope', 'wxs')).toBe('(\"a\" + ctx.eval(\"b\", scope, wxs) + \"c\")')
  })

  it('distinguishes shorthand objects from ternaries and nested colons', () => {
    const build = (value: string) => buildTemplateDataExpression(value, 'scope', 'wxs')
    expect(build('{{ foo: bar }}')).toContain('{ foo: bar }')
    expect(build('{{ foo ? yes : no }}')).toContain('foo ? yes : no')
    expect(build('{{ call({ foo: bar }) }}')).toContain('call({ foo: bar })')
    expect(build('{{ [foo, bar] }}')).toContain('[foo, bar]')
    expect(build('{{ ({ foo: bar }) }}')).toContain('({ foo: bar })')
    expect(build('{{ "foo:bar" }}')).toContain('\\\"foo:bar\\\"')
    expect(build('{{ "foo\\\\\":bar" }}')).toContain('foo')
    expect(build('{{ \'foo\\\\\'s:bar\' }}')).toContain('{ \'foo')
    expect(build('{{ `foo\\`:bar` }}')).toContain('foo')
    expect(build('{{ key: condition ? yes : no }}')).toContain('{ key: condition ? yes : no }')
    expect(build('prefix {{ value }}')).toContain('prefix ')
    expect(build('{{ }}')).toBe('""')
  })

  it('extracts page metadata and merges navigation bar attributes', () => {
    const text = { type: 'text', data: 'before' } as any
    const nestedMeta = {
      type: 'element',
      name: 'view',
      children: [{ type: 'element', name: 'page-meta', children: [] }],
    } as any
    const pageMeta = {
      type: 'element',
      name: 'page-meta',
      children: [{
        type: 'element',
        name: 'navigation-bar',
        attribs: { title: 'Page', loading: 'true', ignored: 'value' },
      }],
    } as any
    const result = extractNavigationBarFromPageMeta([text, pageMeta, nestedMeta])
    expect(result.nodes).toEqual([text, { ...nestedMeta, children: [] }])
    expect(result.attrs).toEqual({ title: 'Page', loading: 'true' })
    expect(result.warnings).toHaveLength(1)
    expect(extractNavigationBarFromPageMeta([text])).toEqual({ nodes: [text], attrs: undefined, warnings: [] })
    expect(extractNavigationBarFromPageMeta([{ type: 'element', name: 'page-meta' } as any]).attrs).toBeUndefined()
    expect(extractNavigationBarFromPageMeta([{
      type: 'element',
      name: 'page-meta',
      children: [{ type: 'element', name: 'navigation-bar' }],
    } as any]).attrs).toBeUndefined()
    expect(extractNavigationBarFromPageMeta([{
      type: 'element',
      name: 'page-meta',
      children: [{ type: 'text', data: 'metadata' }],
    } as any]).attrs).toBeUndefined()
    expect(extractNavigationBarFromPageMeta([{
      type: 'element',
      name: 'page-meta',
      children: [{
        type: 'element',
        name: 'navigation-bar',
        attribs: { ignored: 'value' },
      }],
    } as any]).attrs).toBeUndefined()

    expect(buildNavigationBarAttrs({
      title: 1 as any,
      backgroundColor: true as any,
      textStyle: { invalid: true } as any,
      frontColor: '#ffffff',
      loading: true,
    }, { title: 'Override' })).toEqual({
      'title': 'Override',
      'background-color': 'true',
      'front-color': '#ffffff',
      'loading': 'true',
    })
    expect(buildNavigationBarAttrs({
      title: null as any,
      backgroundColor: null as any,
      textStyle: null as any,
      frontColor: null as any,
      loading: false,
    })).toEqual({})
    expect(buildNavigationBarAttrs(undefined)).toEqual({})
  })

  it('collects templates, dependencies, WXS and unsupported-node warnings', () => {
    const context = {
      templates: [] as any[],
      includes: [] as any[],
      imports: [] as any[],
      wxs: [] as any[],
      wxsModules: new Map<string, string>([['duplicate', 'previous.wxml']]),
      warnings: [] as string[],
      sourceId: 'page.wxml',
      resolveTemplate: (raw: string) => raw.includes('missing') ? undefined : `/resolved/${raw}`,
      resolveWxs: (raw: string) => raw.includes('missing') ? undefined : `/resolved/${raw}`,
    }
    const nodes = [
      { type: 'element' },
      { type: 'element', name: 'editor', children: [] },
      { type: 'element', name: 'editor', children: [] },
      { type: 'element', name: 'template', attribs: { name: 'card' }, children: [{ type: 'text', data: 'Card' }] },
      { type: 'element', name: 'template', attribs: { name: 'empty' } },
      { type: 'element', name: 'import', attribs: { src: './found.wxml' } },
      { type: 'element', name: 'import', attribs: { src: './missing.wxml' } },
      { type: 'element', name: 'include', attribs: { src: './found.wxml' } },
      { type: 'element', name: 'include', attribs: { src: './missing.wxml' } },
      { type: 'element', name: 'wxs', attribs: { module: 'external', src: './tool.wxs' } },
      { type: 'element', name: 'wxs', attribs: { module: 'missing', src: './missing.wxs' } },
      { type: 'element', name: 'wxs', attribs: { module: 'inline' }, children: [{ type: 'text', data: 'module.exports = 1' }, { type: 'element', name: 'view' }] },
      { type: 'element', name: 'wxs', attribs: { module: 'empty-inline' }, children: [{ type: 'text' }] },
      { type: 'element', name: 'wxs', attribs: { module: ' duplicate ' }, children: [] },
      { type: 'element', name: 'wxs', attribs: {} },
      { type: 'element', name: 'view', children: [{ type: 'element', name: 'audio', children: [] }] },
    ] as any[]
    const renderable = collectSpecialNodes(nodes, context)
    expect(context.templates).toHaveLength(2)
    expect(context.imports).toHaveLength(1)
    expect(context.includes).toHaveLength(1)
    expect(context.wxs.map(entry => entry.kind)).toEqual(['src', 'inline', 'inline', 'inline'])
    expect(context.warnings.filter(message => message.includes('<editor>'))).toHaveLength(1)
    expect(context.warnings.some(message => message.includes('无法解析模板依赖'))).toBe(true)
    expect(context.warnings.some(message => message.includes('WXS 模块名重复'))).toBe(true)
    expect(renderable.some(node => node.type === 'element' && node.name === 'view')).toBe(true)

    expect(shouldMarkWxsImport('tool.wxs')).toBe(false)
    expect(shouldMarkWxsImport('tool.wxs.ts')).toBe(false)
    expect(shouldMarkWxsImport('tool.wxs.js')).toBe(false)
    expect(shouldMarkWxsImport('tool.ts')).toBe(true)
    expect(shouldMarkWxsImport('tool.js')).toBe(true)
    expect(shouldMarkWxsImport('tool.json')).toBe(false)
    expect(normalizeTemplatePath('a\\b\\c')).toBe('a/b/c')
    expect(toTemplateRelativeImport('/a/page.wxml', '/a/part.wxml')).toBe('./part.wxml')
    expect(toTemplateRelativeImport('/a/page.wxml', '/a/page.wxml')).toBe('./page.wxml')
    expect(toTemplateRelativeImport('/a/page.wxml', '/a')).toBe('./a')
  })

  it('normalizes plugin paths and resolves real extension candidates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-path-'))
    const src = join(root, 'src')
    const pages = join(src, 'pages')
    await mkdir(pages, { recursive: true })
    const importer = join(pages, 'index.js')
    const template = join(pages, 'part.wxml')
    const wxs = join(pages, 'tool.wxs.ts')
    await writeFile(importer, '')
    await writeFile(template, '<view />')
    await writeFile(wxs, 'export default {}')

    expect(cleanUrl('/a/file.ts?query')).toBe('/a/file.ts')
    expect(cleanUrl('/a/file.ts')).toBe('/a/file.ts')
    expect(normalizePath('a\\b/../c')).toBe('a/c')
    expect(isInsideDir(template, src)).toBe(true)
    expect(isInsideDir(root, src)).toBe(false)
    expect(isInsideDir(src, src)).toBe(true)
    expect(isHtmlEntry(join(root, 'INDEX.HTML'), root)).toBe(false)
    expect(isHtmlEntry(join(root, 'index.html'), root)).toBe(true)
    expect(isHtmlEntry(join(root, 'other.html'), root)).toBe(false)
    expect(toPosixId('a\\b')).toBe('a/b')
    expect(toRelativeImport(importer, template)).toBe('./part.wxml')
    expect(toRelativeImport(importer, importer)).toBe('./index.js')
    expect(appendInlineQuery('/a.css')).toBe('/a.css?inline')
    expect(appendInlineQuery('/a.css?raw')).toBe('/a.css?raw&inline')
    expect(appendInlineQuery('/a.css?inline')).toBe('/a.css?inline')
    expect(appendInlineQuery('/a.css?raw&inline')).toBe('/a.css?raw&inline')
    expect(appendQuery('/a', 'raw')).toBe('/a?raw')
    expect(appendQuery('/a?x=1', 'raw')).toBe('/a?x=1&raw')
    expect(relativeModuleId(root, template)).toBe('/src/pages/part.wxml')
    expect(toViteFsImport('/absolute/file')).toBe('/@fs/absolute/file')
    expect(toViteFsImport('C:\\file')).toBe('/@fs/C:/file')
    expect(resolveRuntimePolyfillPath()).toMatch(/runtime\/(?:index\.(?:ts|mjs)|polyfill\.ts)$/)
    expect(resolveImportBase('', importer, src)).toBeUndefined()
    expect(resolveImportBase('./part', importer, src)).toBe(normalizePath(join(pages, 'part')))
    expect(resolveImportBase('/pages/part', importer, src)).toBe(normalizePath(join(pages, 'part')))
    expect(resolveImportBase('pages/part', importer, src)).toBe(normalizePath(join(pages, 'part')))
    expect(resolveFileWithExtensionsSync(template, ['.wxml'])).toBe(template)
    expect(resolveFileWithExtensionsSync(join(pages, 'part'), ['.wxml'])).toBe(template)
    expect(resolveFileWithExtensionsSync(join(pages, 'missing'), ['.wxml'])).toBeUndefined()
    expect(resolveTemplatePathSync('./part', importer, src)).toBe(normalizePath(template))
    expect(resolveTemplatePathSync('', importer, src)).toBeUndefined()
    expect(resolveWxsPathSync('./tool', importer, src)).toBe(normalizePath(wxs))
    expect(resolveWxsPathSync('/pages/tool', importer, src)).toBe(normalizePath(wxs))
    expect(resolveWxsPathSync('package/tool', importer, src)).toBeUndefined()
    expect(resolveWxsPathSync('', importer, src)).toBeUndefined()
  })

  it('reads JSON and executable configs and resolves neighboring source files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-files-'))
    const validJson = join(root, 'valid.json')
    const invalidJson = join(root, 'invalid.json')
    const arrayJson = join(root, 'array.json')
    const dynamicBase = join(root, 'dynamic.json')
    const functionBase = join(root, 'function.json')
    const invalidDynamicBase = join(root, 'invalid-dynamic.json')
    await writeFile(validJson, '{"value":1}')
    await writeFile(invalidJson, '{bad')
    await writeFile(arrayJson, '[]')
    await writeFile(`${dynamicBase}.ts`, 'export default { value: 2 }')
    await writeFile(`${functionBase}.js`, 'export default async () => ({ value: 3 })')
    await writeFile(`${invalidDynamicBase}.js`, 'export default []')

    expect(isRecord({})).toBe(true)
    expect(isRecord(null)).toBe(false)
    expect(isRecord([])).toBe(false)
    await expect(readJsonFile(validJson)).resolves.toEqual({ value: 1 })
    await expect(readJsonFile(invalidJson)).resolves.toBeUndefined()
    await expect(readJsonFile(arrayJson)).resolves.toBeUndefined()
    await expect(readJsonFile(dynamicBase)).resolves.toEqual({ value: 2 })
    await expect(readJsonFile(functionBase)).resolves.toEqual({ value: 3 })
    await expect(readJsonFile(invalidDynamicBase)).resolves.toBeUndefined()
    await expect(readJsonFile(join(root, 'missing.json'))).resolves.toBeUndefined()
    await expect(resolveJsonPath(validJson)).resolves.toBe(validJson)
    await expect(resolveJsonPath(dynamicBase)).resolves.toBe(`${dynamicBase}.ts`)
    await expect(resolveJsonPath(join(root, 'missing.json'))).resolves.toBeUndefined()

    const script = join(root, 'page.ts')
    const style = join(root, 'page.scss')
    const template = join(root, 'page.wxml')
    await writeFile(script, 'export default {}')
    await writeFile(style, '.page {}')
    await writeFile(template, '<view />')
    await expect(resolveScriptFile(script)).resolves.toBe(script)
    await expect(resolveScriptFile(join(root, 'page'))).resolves.toBe(script)
    await expect(resolveScriptFile(join(root, 'missing'))).resolves.toBeUndefined()
    await expect(resolveStyleFile(script)).resolves.toBe(style)
    await expect(resolveTemplateFile(script)).resolves.toBe(template)
    await expect(resolveStyleFile(join(root, 'missing.ts'))).resolves.toBeUndefined()
    await expect(resolveTemplateFile(join(root, 'missing.ts'))).resolves.toBeUndefined()
  })
})
