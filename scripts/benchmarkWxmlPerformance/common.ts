import type { Case } from './measure'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'

/** 所有版本都存在的编译和 simulator 观察入口，使用相同输入与断言。 */
export async function commonCases(load: (file: string) => Promise<any>, cleanup: boolean): Promise<Case[]> {
  const { compileVueTemplateToWxml: compile } = await load('packages-runtime/wevu-compiler/src/plugins/vue/compiler/template.ts')
  const { parseWxsTemplateDocument: parse } = await load('mpcore/packages/simulator/src/view/wxsDocument.ts')
  const { interpolateTemplateText: interpolate } = await load('mpcore/packages/simulator/src/view/templateText.ts')
  const { createBrowserHeadlessSession, createBrowserVirtualFiles } = await load('mpcore/packages/simulator/src/browser/index.ts')
  const cases: Case[] = []
  const removeComments = cleanup ? (await load('packages/weapp-vite/src/wxml/remove/index.ts')).createWxmlRemover({ comment: true }) : (code: string) => code
  for (const count of [100, 1000, 5000]) {
    const source = `<view>${'<view data-testid="x" a="{{value}}"><text>中文</text></view>'.repeat(count)}</view>`
    const files = createBrowserVirtualFiles([
      ['app.json', '{"pages":["pages/index/index"]}'],
      ['app.js', 'App({})'],
      ['pages/index/index.js', 'Page({data:{value:"initial"}})'],
      ['pages/index/index.wxml', source],
    ])
    cases.push({
      name: `simulator/public-render/${count}`,
      bytes: Buffer.byteLength(source),
      run: () => {
        const session = createBrowserHeadlessSession({ files })
        try {
          const page = session.reLaunch('/pages/index/index')
          page.setData({ value: 'updated' })
          return session.renderCurrentPage().wxml
        }
        finally {
          session.close()
        }
      },
      verify: (result) => {
        assert.equal(result.match(/a="updated"/g)?.length, count)
        assert.equal(result.match(/中文/g)?.length, count)
      },
    })
    cases.push({
      name: `simulator/parse/${count}`,
      bytes: Buffer.byteLength(source),
      run: () => parse(source),
      verify: result => assert.equal(result.children[0].children[0].children.length, count),
    })
    const withWxs = `<wxs module="x">module.exports = { value: "<text/>" }</wxs>${source}`
    cases.push({
      name: `simulator/parse-wxs/${count}`,
      bytes: Buffer.byteLength(withWxs),
      run: () => parse(withWxs),
      verify: (result) => {
        assert.equal(result.children[0].children[1].children.length, count)
        assert.equal(result.children[0].children[0].children[0].data, 'module.exports = { value: "<text/>" }')
      },
    })
    for (const binding of [false, true]) {
      const input = (binding ? '中文 {{value}} / ' : '中文文字 / ').repeat(count)
      cases.push({
        name: `simulator/text-${binding ? 'binding' : 'static'}/${count}`,
        bytes: Buffer.byteLength(input),
        run: () => interpolate(input, { value: 'ok' }),
        verify: result => assert.equal(result, (binding ? '中文 ok / ' : '中文文字 / ').repeat(count)),
      })
    }
    for (const comments of [false, true]) {
      const input = `<div>${`${comments ? '<!-- comment -->' : ''}<span :title="value">{{value}}</span>`.repeat(count)}</div>`
      cases.push({
        name: `compiler/${comments ? 'comments' : 'plain'}/${count}`,
        bytes: Buffer.byteLength(input),
        run: () => compile(input, 'pages/bench.vue'),
        verify: (result) => {
          assert.equal(result.diagnostics.length, 0)
          assert.equal(result.code.match(/<text\b/g)?.length, count)
          assert.ok(!result.code.includes('<!--'))
        },
      })
      cases.push({
        name: `compiler/pipeline-${comments ? 'comments' : 'plain'}/${count}`,
        bytes: Buffer.byteLength(input),
        run: () => {
          const result = compile(input, 'pages/bench.vue', { preserveComments: true })
          result.code = removeComments(result.code, 'pages/bench.wxml')
          return result
        },
        verify: (result) => {
          assert.equal(result.diagnostics.length, 0)
          assert.equal(result.code.match(/<text\b/g)?.length, count)
          assert.ok(!result.code.includes('<!--'))
        },
      })
    }
  }
  return cases
}
