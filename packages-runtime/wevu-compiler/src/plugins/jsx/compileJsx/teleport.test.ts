import type { CompileVueFileOptions } from '../../vue/transform/compileVueFile/types'
import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from '../../vue/compiler/template'
import { compileVueFile } from '../../vue/transform/compileVueFile'
import { compileJsxFile } from '../compileJsxFile'

const filename = 'src/pages/teleport/index.tsx'
const jsxSource = (element: string) => `export default { render() { return (${element}) } }`

describe('Teleport compiler parity', () => {
  it.each([
    ['unsupported target', { template: {} }, '#inner'],
    ['disabled mapping', { template: { teleport: { enabled: false } } }, 'body'],
    ['unsupported platform', { template: { platform: getMiniProgramTemplatePlatform('alipay') } }, 'body'],
  ] as const)('preserves JSX v-if when degrading with %s', async (_name, options, target) => {
    const result = await compileJsxFile(jsxSource(`<Teleport to="${target}" v-if={visible}><view>A</view></Teleport>`), filename, options)
    const platform = options.template && 'platform' in options.template ? options.template.platform : getMiniProgramTemplatePlatform()
    expect(result.template).toBe(`<block ${platform.directives.ifAttr}="{{visible}}"><view>A</view></block>`)
    expect(result.bindingManifest?.bindings).toContainEqual(expect.objectContaining({ kind: 'if', sourceRoots: ['visible'] }))
  })

  it.each(['disabled: true', 'to: target'])('degrades spread %s even with an explicit target', async (property) => {
    const jsx = await compileJsxFile(jsxSource(`<Teleport to="body" {...{ ${property} }}><view>A</view></Teleport>`), filename)
    const template = compileVueTemplateToWxml(`<Teleport to="body" v-bind="{ ${property} }"><view>A</view></Teleport>`, 'src/pages/teleport/index.vue')
    for (const result of [jsx, { ...template, template: template.code }]) {
      expect(result.template).toBe('<view>A</view>')
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'WV1006', severity: 'warning' }))
    }
  })

  const unsupported = [
    ['missing', '<Teleport><view>A</view></Teleport>', 'WV1004'],
    ['dynamic', '<Teleport to={target}><view>A</view></Teleport>', 'WV1005'],
    ['spread', '<Teleport to="body" {...attrs}><view>A</view></Teleport>', 'WV1006'],
    ['target', '<Teleport to="#inner"><view>A</view></Teleport>', 'WV1007'],
  ] as const

  it.each(unsupported)('preserves the %s JSX diagnostic code and location', async (_name, element, code) => {
    const result = await compileJsxFile(jsxSource(element), filename)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, severity: 'warning', source: 'jsx', loc: expect.any(Object) }))
  })

  it.each(unsupported)('rejects unsupported JSX %s with strict diagnostics in both entry points', async (_name, element, code) => {
    const options: CompileVueFileOptions = { template: { teleport: { unsupported: 'error' } } }
    const source = jsxSource(element)
    for (const compile of [
      () => compileJsxFile(source, filename, options),
      () => compileVueFile(`<script lang="tsx">${source}</script>`, 'src/pages/teleport/index.vue', options),
    ]) {
      await expect(compile()).rejects.toMatchObject({ name: 'CompilerDiagnosticError', code, severity: 'error', source: 'jsx' })
    }
  })

  it.each(['\n', '\r\n'])('maps strict JSX SFC diagnostics back to original %j source', async (newline) => {
    const element = '<Teleport to="#inner"><view>A</view></Teleport>'
    const source = ['', '<script lang="tsx">', `export default { render() { return ${element} } }`, '</script>'].join(newline)
    try {
      await compileVueFile(source, 'src/pages/teleport/index.vue', { template: { teleport: { unsupported: 'error' } } })
      expect.unreachable('Expected a fatal Teleport diagnostic')
    }
    catch (error) {
      expect(error).toMatchObject({ code: 'WV1007', source: 'jsx', loc: { start: { offset: source.indexOf(element), line: 3 } } })
      const diagnostic = error as { loc: { start: { offset: number }, end: { offset: number } } }
      expect(source.slice(diagnostic.loc.start.offset, diagnostic.loc.end.offset)).toBe(element)
    }
  })

  it('keeps version and class warnings nonfatal in strict mode', async () => {
    const result = await compileJsxFile(jsxSource('<Teleport to="body" class="overlay"><view>A</view></Teleport>'), filename, {
      template: { teleport: { unsupported: 'error' } },
    })
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WV1009', severity: 'warning' }),
      expect.objectContaining({ code: 'WV1010', severity: 'warning' }),
    ]))
  })
})
