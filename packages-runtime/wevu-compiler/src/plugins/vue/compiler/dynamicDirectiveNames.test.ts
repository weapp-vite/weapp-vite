import type { CompilerDiagnostic } from '../../../types/diagnostics'
import { describe, expect, it, vi } from 'vitest'
import { compileVueFile } from '../transform/compileVueFile'
import { compileVueTemplateToWxml } from './template'
import { alipayPlatform, swanPlatform, ttPlatform, wechatPlatform } from './template/platforms'

function diagnosticSource(source: string, diagnostic: CompilerDiagnostic) {
  return diagnostic.loc
    ? source.slice(diagnostic.loc.start.offset, diagnostic.loc.end.offset)
    : ''
}

function collectDynamicNameDiagnostics(source: string, diagnostics: CompilerDiagnostic[]) {
  return diagnostics.filter((diagnostic) => {
    const span = diagnosticSource(source, diagnostic)
    return span.startsWith(':[') || span.startsWith('@[')
  })
}

const DYNAMIC_TEMPLATE = '<view :[attr]="value" @[event]="handle" />'
const PLATFORMS = [
  ['wechat', wechatPlatform],
  ['alipay', alipayPlatform],
  ['douyin', ttPlatform],
  ['baidu', swanPlatform],
] as const

describe('dynamic directive names', () => {
  it.each(PLATFORMS)('rejects dynamic v-bind and v-on names before %s lowering', (_name, platform) => {
    const result = compileVueTemplateToWxml(
      DYNAMIC_TEMPLATE,
      '/project/src/components/dynamic-name.vue',
      { platform },
    )

    expect(result.code).toBe('<view />')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'WV1001',
        severity: 'warning',
        message: expect.stringContaining('v-bind'),
        source: 'template',
      }),
      expect.objectContaining({
        code: 'WV1001',
        severity: 'warning',
        message: expect.stringContaining('v-on'),
        source: 'template',
      }),
    ])
    expect(result.diagnostics.map(diagnostic => diagnosticSource(DYNAMIC_TEMPLATE, diagnostic)))
      .toEqual([':[attr]="value"', '@[event]="handle"'])
  })

  it('maps dynamic-name diagnostics to the original SFC and warn callback', async () => {
    const source = `<script setup>
const attr = 'title'
const value = 'A'
const event = 'tap'
const handle = () => {}
</script>
<template>
  <view :[attr]="value" @[event]="handle" />
</template>`
    const warn = vi.fn()
    const result = await compileVueFile(source, '/project/src/components/dynamic-name.vue', { warn })

    expect(result.template).toBe('<view />')
    expect(result.diagnostics?.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: diagnosticSource(source, diagnostic),
      start: diagnostic.loc?.start,
    }))).toEqual([
      {
        code: 'WV1001',
        severity: 'warning',
        source: ':[attr]="value"',
        start: {
          offset: source.indexOf(':[attr]'),
          line: 8,
          column: 9,
        },
      },
      {
        code: 'WV1001',
        severity: 'warning',
        source: '@[event]="handle"',
        start: {
          offset: source.indexOf('@[event]'),
          line: 8,
          column: 25,
        },
      },
    ])
    expect(result.diagnostics?.[0]?.message).toContain('v-bind')
    expect(result.diagnostics?.[1]?.message).toContain('v-on')
    expect(warn.mock.calls.map(([message]) => message))
      .toEqual(result.diagnostics?.map(diagnostic => diagnostic.message))
  })

  it('keeps static bindings, native event mapping, and component events unchanged', () => {
    const result = compileVueTemplateToWxml(`
<view :title="value" @click="handle" />
<StaticCard :label="value" @ready="handle" />
    `.trim(), '/project/src/components/static-controls.vue', { platform: wechatPlatform })

    expect(result.diagnostics).toEqual([])
    expect(result.code).toContain('<view title="{{value}}" bindtap="handle" />')
    expect(result.code).toContain('<static-card label="{{value}}"')
    expect(result.code).toContain('data-wd-ready="1"')
    expect(result.code).toContain('bindready="__weapp_vite_inline"')
  })

  it('rejects dynamic names before tag-specific binding prepasses', () => {
    const source = [
      '<view :[ref]="target" />',
      '<component :[is]="kind" />',
      '<slot :[name]="payload" />',
      '<view v-for="item in items" :[key]="item.id" />',
    ].join('\n')
    const result = compileVueTemplateToWxml(
      source,
      '/project/src/components/dynamic-special-names.vue',
      { platform: wechatPlatform },
    )
    const dynamicDiagnostics = collectDynamicNameDiagnostics(source, result.diagnostics)

    for (const diagnostic of dynamicDiagnostics) {
      expect(diagnostic).toMatchObject({
        code: 'WV1001',
        severity: 'warning',
        source: 'template',
      })
    }
    expect(dynamicDiagnostics.map(diagnostic => diagnosticSource(source, diagnostic))).toEqual([
      ':[ref]="target"',
      ':[is]="kind"',
      ':[name]="payload"',
      ':[key]="item.id"',
    ])
    expect(result.code).toBe('<view /><component /><slot /><view wx:for="{{items}}" wx:for-item="item" wx:for-index="__wv_index_0" />')
    expect(result.templateRefs).toBeUndefined()
  })

  it('rejects dynamic names in plain slot fallbacks across slot compiler modes', () => {
    const source = '<Card><template #header><slot :[name]="payload" @[event]="handle" /></template></Card>'

    for (const scopedSlotsCompiler of ['augmented', 'off'] as const) {
      const result = compileVueTemplateToWxml(
        source,
        '/project/src/components/dynamic-fallback-name.vue',
        { platform: wechatPlatform, scopedSlotsCompiler },
      )
      const dynamicDiagnostics = collectDynamicNameDiagnostics(source, result.diagnostics)

      for (const diagnostic of dynamicDiagnostics) {
        expect(diagnostic).toMatchObject({
          code: 'WV1001',
          severity: 'warning',
          source: 'template',
        })
      }
      expect(dynamicDiagnostics[0]?.message).toContain('v-bind')
      expect(dynamicDiagnostics[1]?.message).toContain('v-on')
      expect(dynamicDiagnostics.map(diagnostic => diagnosticSource(source, diagnostic))).toEqual([
        ':[name]="payload"',
        '@[event]="handle"',
      ])
      expect(result.code).not.toContain('name="{{payload}}"')
      expect(result.code).not.toContain('bindevent=')
      expect(result.code).toContain('<slot />')
    }
  })

  it('rejects dynamic names on explicit template slot children across slot compiler modes', () => {
    const source = '<Card><template #header :[ref]="target" @[event]="handle"><view /></template></Card>'

    for (const scopedSlotsCompiler of ['augmented', 'off'] as const) {
      const result = compileVueTemplateToWxml(
        source,
        '/project/src/components/dynamic-template-slot-name.vue',
        { platform: wechatPlatform, scopedSlotsCompiler },
      )
      const dynamicDiagnostics = collectDynamicNameDiagnostics(source, result.diagnostics)

      for (const diagnostic of dynamicDiagnostics) {
        expect(diagnostic).toMatchObject({
          code: 'WV1001',
          severity: 'warning',
          source: 'template',
        })
      }
      expect(dynamicDiagnostics[0]?.message).toContain('v-bind')
      expect(dynamicDiagnostics[1]?.message).toContain('v-on')
      expect(dynamicDiagnostics.map(diagnostic => diagnosticSource(source, diagnostic))).toEqual([
        ':[ref]="target"',
        '@[event]="handle"',
      ])
      const emittedTemplates = [
        result.code,
        ...(result.scopedSlotComponents?.map(component => component.template) ?? []),
      ]
      const emittedCode = emittedTemplates.join('')
      expect(emittedCode).not.toContain('target=')
      expect(emittedCode).not.toContain('bindevent=')
      expect(emittedCode).toContain('<view />')
      expect(result.code).toContain('vue-slots="{{ {header:true} }}"')
    }
  })
})
