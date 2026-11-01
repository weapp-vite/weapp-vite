import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import { describe, expect, it } from 'vitest'
import { formatDocument } from './index'

function cssSemantics(source: string) {
  const normalizeValue = (value: string) => {
    const nodes = valueParser(value).nodes
    const visit = (items: typeof nodes): unknown[] => items.filter(node => node.type !== 'space').map(node => ({
      type: node.type,
      value: node.value,
      ...('nodes' in node ? { nodes: visit(node.nodes) } : {}),
    }))
    return visit(nodes)
  }
  const visit = (nodes: postcss.ChildNode[]): unknown[] => nodes.map(node => ({
    type: node.type,
    ...(node.type === 'comment' ? { text: node.text.trim() } : {}),
    ...(node.type === 'rule' ? { selector: node.selector } : {}),
    ...(node.type === 'decl' ? { prop: node.prop, important: Boolean(node.important), value: normalizeValue(node.value) } : {}),
    ...(node.type === 'atrule' ? { name: node.name, params: normalizeValue(node.params) } : {}),
    ...('nodes' in node && node.nodes ? { nodes: visit(node.nodes) } : {}),
  }))
  return visit(postcss.parse(source).nodes)
}

describe('shared multi-platform formatter', () => {
  it.each(['wxml', 'axml', 'ttml', 'swan', 'jxml', 'qml', 'ksml', 'xhsml', 'tyml'])('formats %s without changing protected template source', async (extension) => {
    const source = '\uFEFF<view   data-x=raw  class=\'box\'><text>前缀  {{ value }}\r\n  后缀</text><!-- keep --><![CDATA[<unchanged>]]></view>\r\n'
    const result = await formatDocument(source, `page.${extension}`)
    expect(result).toContain('<view data-x=raw class=\'box\'>')
    expect(result).toContain('<text>前缀  {{ value }}\r\n  后缀</text><!-- keep --><![CDATA[<unchanged>]]>')
    expect(await formatDocument(result, `page.${extension}`)).toBe(result)
  })

  it.each(['wxss', 'acss', 'ttss', 'qss', 'jxss', 'tyss', 'css'])('formats %s preserving native CSS and Tailwind semantics', async (extension) => {
    const source = '@import "./shared.css";/* #ifdef MP-WEIXIN */\npage{--size:2rpx}.box:hover{width:calc(100% - 20rpx);content:" A  B ";background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")}@theme{--color-primary:#123456}@utility box-size{width:128rpx}/* #endif */'
    const formatted = await formatDocument(source, `page.${extension}`)
    for (const value of ['20rpx', '128rpx', ' A  B ', '@theme', '@utility', '#ifdef MP-WEIXIN', '#endif', 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E']) {
      expect(formatted).toContain(value)
    }
    expect(cssSemantics(formatted)).toEqual(cssSemantics(source))
    expect(formatted.indexOf('@import')).toBeLessThan(formatted.indexOf('page'))
    expect(await formatDocument(formatted, `page.${extension}`)).toBe(formatted)
  })

  it('formats inline TS and native WXS while protecting text and module semantics', async () => {
    const source = '<wxs module="typed" lang="ts">export default {value:1 as number}</wxs><wxs module="native">module.exports={value:1};/* tail</wxs><text>  {{ typed.value }}  </text>'
    const result = await formatDocument(source, 'page.wxml')
    expect(result).toContain('1 as number')
    expect(result).toContain('/* tail</wxs>')
    expect(result).toContain('<text>  {{ typed.value }}  </text>')
    expect(await formatDocument(result, 'page.wxml')).toBe(result)
  })

  it('shares inline JavaScript and Baidu filter dialect selection with analysis', async () => {
    const web = '<script>const message="</view>";export default {message}</script><text>  保留  </text>'
    const formattedWeb = await formatDocument(web, 'page.wxml')
    expect(formattedWeb).toContain('const message = \'</view>\'')
    expect(formattedWeb).toContain('<text>  保留  </text>')
    expect(await formatDocument(formattedWeb, 'page.wxml')).toBe(formattedWeb)
    const filter = '<filter module="tools">export default { label:function(value){return value} }</filter><text>{{tools.label(value)}}</text>'
    const formattedFilter = await formatDocument(filter, 'page.swan')
    expect(await formatDocument(formattedFilter, 'page.swan')).toBe(formattedFilter)
    expect(await formatDocument('export default { label:function(value){return value} }', 'tools.filter.js')).toContain('label: function')
    await expect(formatDocument('export default { label:function(value){return value ? 1 : 2} }', 'tools.filter.js')).rejects.toThrow()
  })

  it('rejects malformed scripts, templates and styles', async () => {
    await expect(formatDocument('<view><text></view>', 'page.axml')).rejects.toThrow()
    await expect(formatDocument('module.exports = {', 'page.wxs')).rejects.toThrow()
    await expect(formatDocument('.box{width:', 'page.acss')).rejects.toThrow()
  })
})
