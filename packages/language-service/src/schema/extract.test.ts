import { describe, expect, it } from 'vitest'
import { attributesFromCompiledDocs } from '../../scripts/schema/compiled'
import { attributesFromHtml, extractStaticObject } from '../../scripts/schema/html'
import { extractJdPublicChannel } from '../../scripts/schema/jd'
import { attributesFromMarkdown } from '../../scripts/schema/markdown'
import { attributesFromTuyaSchema } from '../../scripts/schema/tuya'

describe('official schema extraction', () => {
  it('reads only attribute tables and decodes documentation entities', () => {
    const body = '<table><tr><th>属性</th><th>类型</th><th>默认值</th><th>说明</th></tr><tr><td>hover-class</td><td>String</td><td>none</td><td>A &amp; B</td></tr></table><table><tr><th>值</th><th>说明</th></tr><tr><td>wrong</td><td>ordinary values</td></tr></table>'
    expect(attributesFromHtml(body)).toEqual([{ name: 'hover-class', type: { name: 'String' }, defaultValue: 'none', desc: ['A & B'] }])
  })

  it('extracts static document state without executing unrelated callbacks', () => {
    const source = '{"callback":function(){throw new Error("not evaluated")},"rootTree":{"title":"{} \\\"quoted\\\" undefined","children":[{"value":undefined}]}}'
    expect(extractStaticObject(source, 'rootTree')).toEqual({ title: '{} "quoted" undefined', children: [{ value: null }] })
    expect(() => extractStaticObject('{}', 'rootTree')).toThrow()
  })

  it('statically reads compiled JSX attribute table children', () => {
    const source = 'jsx(md.table,{children:[jsx(md.tr,{children:[jsx(md.th,{children:"属性"}),jsx(md.th,{children:"类型"})]}),jsx(md.tr,{children:[jsx(md.td,{children:"title"}),jsx(md.td,{children:jsx(md.code,{children:"string"})})]})]})'
    expect(attributesFromCompiledDocs(source).attributes).toEqual([{ name: 'title', type: { name: 'string' } }])
  })

  it('reads Markdown pipes while excluding fenced sample tables', () => {
    const source = '|属性名|类型|说明|\n|---|---|---|\n|mode|string\\|number|mode value|\n\n```\n|属性|类型|\n|---|---|\n|bad|string|\n```'
    expect(attributesFromMarkdown(source)).toEqual([{ name: 'mode', type: { name: 'string|number' }, desc: ['mode value'] }])
  })

  it('converts Tuya official schema literals, types and defaults without evaluating examples', () => {
    const schema = { items: [{ type: 'component', name: 'view', props: [{ name: 'mode', type: { kind: 'union', types: [{ kind: 'literal', value: 'a' }, { kind: 'literal', value: 'b' }] }, description: { zh: '模式' }, defaultValue: false }] }, { type: 'api', name: 'request' }] }
    expect(attributesFromTuyaSchema(schema).get('view')?.attrs).toEqual([{ name: 'mode', type: { name: '"a" | "b"' }, desc: ['模式'], defaultValue: 'false', enum: [{ value: 'a' }, { value: 'b' }] }])
    expect(attributesFromTuyaSchema(schema).has('request')).toBe(false)
  })

  it('resolves public JD channel metadata through static bindings without guessing unrelated literals', () => {
    const source = '({module:function(){const publicChannel="fixture-channel",unrelated="other-value";let alias;function request(){alias=publicChannel;const h={};h.documentChannelToken=alias;return "/api/openapi/front/articleNavigation/tree"}}})'
    expect(extractJdPublicChannel(source)).toBe('fixture-channel')
    expect(() => extractJdPublicChannel('({module:function(){}})')).toThrow()
  })
})
