import { describe, expect, it } from 'vitest'
import { compileJsxTemplate } from '../plugins/jsx/compileJsx/template'
import { compileVueTemplateToWxml } from '../plugins/vue/compiler/template'
import { compileVueFile } from '../plugins/vue/transform/compileVueFile'
import { CompilerDiagnosticCodes } from './diagnostics'

const filename = '/project/src/pages/diagnostics/index.vue'

describe('compiler diagnostics', () => {
  it('emits stable template diagnostic codes and source spans', () => {
    const source = `<view>\n  <text v-html="html" />\n</view>`
    const result = compileVueTemplateToWxml(source, filename)

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: CompilerDiagnosticCodes.templateUnsupportedDirective,
        severity: 'warning',
        filename,
        source: 'template',
        message: '小程序不支持 v-html，请使用 rich-text 组件替代。',
        loc: expect.objectContaining({
          start: {
            offset: source.indexOf('v-html'),
            line: 2,
            column: 9,
          },
        }),
      }),
    ])
  })

  it('marks template parser failures as errors', () => {
    const result = compileVueTemplateToWxml('<view>', filename)

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: CompilerDiagnosticCodes.templateParseError,
      severity: 'error',
      filename,
      source: 'template',
      loc: expect.any(Object),
    }))
  })

  it('offsets template diagnostics to the complete SFC source', async () => {
    const source = `<script setup>\nconst html = '<b>unsafe</b>'\n</script>\n<template>\n  <view v-html="html" />\n</template>`
    const result = await compileVueFile(source, filename)
    const diagnostic = result.diagnostics?.[0]

    expect(diagnostic).toEqual(expect.objectContaining({
      code: CompilerDiagnosticCodes.templateUnsupportedDirective,
      filename,
      loc: expect.objectContaining({
        start: {
          offset: source.indexOf('v-html'),
          line: 5,
          column: 9,
        },
      }),
    }))
  })

  it('preserves original CRLF offsets for complete SFC diagnostics', async () => {
    const source = [
      '<script setup>',
      'const html = \'<b>unsafe</b>\'',
      '</script>',
      '<template>',
      '  <view v-html="html" />',
      '</template>',
    ].join('\r\n')
    const result = await compileVueFile(source, filename)
    const start = result.diagnostics?.[0]?.loc?.start

    expect(start).toEqual({
      offset: source.indexOf('v-html'),
      line: 5,
      column: 9,
    })
    expect(source.slice(start?.offset, (start?.offset ?? 0) + 'v-html'.length)).toBe('v-html')
  })

  it('uses the same diagnostic contract for JSX compilation', () => {
    const source = `export default { render() { return <Teleport /> } }`
    const result = compileJsxTemplate(source, '/project/src/pages/diagnostics/index.tsx')

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: CompilerDiagnosticCodes.jsxUnsupportedSyntax,
      severity: 'warning',
      filename: '/project/src/pages/diagnostics/index.tsx',
      source: 'jsx',
      loc: expect.objectContaining({
        start: expect.objectContaining({
          offset: source.indexOf('<Teleport'),
          line: 1,
        }),
      }),
    }))
  })
})
