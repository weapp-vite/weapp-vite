import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../../../transform/compileVueFile'
import { compileVueTemplateToWxml } from '../../template'

const filename = 'src/components/ObjectDirectives.vue'

function sliceDiagnostic(source: string, diagnostic: { loc?: { start: { offset: number }, end: { offset: number } } }) {
  return diagnostic.loc
    ? source.slice(diagnostic.loc.start.offset, diagnostic.loc.end.offset)
    : undefined
}

describe('object-form v-bind and v-on diagnostics', () => {
  it('reports unsupported native and component object forms without partial expansion', () => {
    const source = [
      '<view title="explicit" v-bind="{ title: \'spread\', id: \'spread-id\' }" v-on="nativeHandlers" />',
      '<ChildPanel :title="explicitTitle" v-bind="componentAttrs" v-on="componentHandlers" />',
    ].join('\n')
    const result = compileVueTemplateToWxml(source, filename)

    expect(result.code).toContain('<view title="explicit" />')
    expect(result.code).toContain('title="{{explicitTitle}}"')
    expect(result.code).not.toContain('spread-id')
    expect(result.diagnostics).toHaveLength(4)
    expect(result.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(source, diagnostic),
    }))).toEqual([
      {
        code: 'WV1001',
        severity: 'warning',
        source: 'v-bind="{ title: \'spread\', id: \'spread-id\' }"',
      },
      {
        code: 'WV1001',
        severity: 'warning',
        source: 'v-on="nativeHandlers"',
      },
      {
        code: 'WV1001',
        severity: 'warning',
        source: 'v-bind="componentAttrs"',
      },
      {
        code: 'WV1001',
        severity: 'warning',
        source: 'v-on="componentHandlers"',
      },
    ])
  })

  it('remaps unsupported object diagnostics to the original SFC source', async () => {
    const source = [
      '<script setup>',
      'const attrs = {}',
      'const handlers = {}',
      '</script>',
      '<template>',
      '  <view v-bind="attrs" v-on="handlers" />',
      '</template>',
    ].join('\n')
    const result = await compileVueFile(source, filename)

    expect(result.diagnostics?.map(diagnostic => ({
      filename: diagnostic.filename,
      line: diagnostic.loc?.start.line,
      column: diagnostic.loc?.start.column,
      source: sliceDiagnostic(source, diagnostic),
    }))).toEqual([
      {
        filename,
        line: 6,
        column: 9,
        source: 'v-bind="attrs"',
      },
      {
        filename,
        line: 6,
        column: 24,
        source: 'v-on="handlers"',
      },
    ])
  })

  it('distinguishes malformed no-expression directives from unsupported object forms', () => {
    const source = '<view v-bind v-on />'
    const result = compileVueTemplateToWxml(source, filename)

    expect(result.code).toBe('<view />')
    expect(result.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(source, diagnostic),
    }))).toEqual([
      {
        code: 'WV2001',
        severity: 'error',
        source: 'v-bind',
      },
      {
        code: 'WV2001',
        severity: 'error',
        source: 'v-on',
      },
    ])
  })

  it('reports unsupported listeners on plain and structural slot outlets', () => {
    const source = [
      '<slot v-on="handlers" />',
      '<slot v-if="visible" v-on="handlers" />',
      '<slot v-for="item in items" v-on="handlers" />',
    ].join('\n')
    const result = compileVueTemplateToWxml(source, filename)

    expect(result.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(source, diagnostic),
    }))).toEqual(Array.from({ length: 3 }, () => ({
      code: 'WV1001',
      severity: 'warning',
      source: 'v-on="handlers"',
    })))
    const malformedSource = '<slot v-bind v-on="" />'
    const malformed = compileVueTemplateToWxml(malformedSource, filename)
    expect(malformed.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      source: sliceDiagnostic(malformedSource, diagnostic),
    }))).toEqual([
      { code: 'WV2001', source: 'v-bind' },
      { code: 'WV2001', source: 'v-on=""' },
    ])
  })

  it('reports no-argument directives through plain slot fallback rendering exactly once', () => {
    const unsupportedSource = '<script setup>const handlers = {}</script><template><Card><template #header><slot v-on="handlers" /></template></Card></template>'
    const unsupported = compileVueTemplateToWxml(unsupportedSource, filename)

    expect(unsupported.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(unsupportedSource, diagnostic),
    }))).toEqual([{
      code: 'WV1001',
      severity: 'warning',
      source: 'v-on="handlers"',
    }])

    const malformedSource = '<template><Card><template #header><slot v-bind v-on="" /></template></Card></template>'
    const malformed = compileVueTemplateToWxml(malformedSource, filename)
    expect(malformed.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(malformedSource, diagnostic),
    }))).toEqual([
      { code: 'WV2001', severity: 'error', source: 'v-bind' },
      { code: 'WV2001', severity: 'error', source: 'v-on=""' },
    ])

    const offModeSource = '<slot v-on="handlers" /><slot v-bind v-on="" />'
    const offMode = compileVueTemplateToWxml(offModeSource, filename, {
      scopedSlotsCompiler: 'off',
    })
    expect(offMode.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(offModeSource, diagnostic),
    }))).toEqual([
      { code: 'WV1001', severity: 'warning', source: 'v-on="handlers"' },
      { code: 'WV2001', severity: 'error', source: 'v-bind' },
      { code: 'WV2001', severity: 'error', source: 'v-on=""' },
    ])
  })

  it('preserves the existing disabled-scope handling for fallback slot object payloads', () => {
    const source = '<script setup>const slotProps = { label: "ready" }</script><template><Card><template #header><slot v-bind="slotProps" /></template></Card></template>'
    const result = compileVueTemplateToWxml(source, filename)

    expect(result.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      source: sliceDiagnostic(source, diagnostic),
    }))).toEqual([{
      code: 'WV1001',
      severity: 'warning',
      source: '<slot v-bind="slotProps" />',
    }])
    expect(result.code).toContain('<slot />')
    expect(result.code).not.toContain('__wvSlotProps=')
  })

  it('preserves explicit bindings, explicit events and scoped-slot object payloads', () => {
    const controls = compileVueTemplateToWxml(
      '<view :title="title" @tap="nativeHandler" /><ChildPanel :label="label" @change="componentHandler" />',
      filename,
    )
    const scopedSlot = compileVueTemplateToWxml('<slot v-bind="slotProps" />', filename)

    expect(controls.diagnostics).toEqual([])
    expect(controls.code).toContain('title="{{title}}"')
    expect(controls.code).toContain('bindtap="nativeHandler"')
    expect(controls.code).toContain('label="{{label}}"')
    expect(controls.code).toContain('bindchange="__weapp_vite_inline"')
    expect(scopedSlot.diagnostics).toEqual([])
    expect(scopedSlot.code).toContain('__wvSlotProps="{{slotProps}}"')
  })
})
