import type { ResolvedPageLayout } from './types'
import { runInNewContext } from 'node:vm'
import { decodeAttribute } from '@weapp-vite/wxml/core'
import { describe, expect, it } from 'vitest'
import { compileVueFile, getMiniProgramTemplatePlatform } from 'wevu/compiler'
import { scanTemplate } from '../../../../wxml/template/scan'
import { buildDynamicLayoutTemplate } from './template'

describe('dynamic layout template attributes', () => {
  it.each(['weapp', 'alipay'] as const)('keeps native and Vue string fallback expressions inside complete %s attributes', async (platform) => {
    const layout: ResolvedPageLayout = {
      file: 'layouts/default.vue',
      importPath: '/layouts/default',
      kind: 'vue',
      layoutName: 'default',
      tagName: 'weapp-layout-default',
      props: { mode: '原生页面', title: 'A "quoted" & <tag> \'title\' \\path' },
    }
    const syntax = platform === 'weapp' ? 'legacy' : 'xml'
    const compiled = await compileVueFile('<template><view /></template>', 'pages/index/index.vue', {
      isPage: true,
      template: { platform: getMiniProgramTemplatePlatform(platform) },
      pageLayout: { currentLayout: layout, layouts: [layout], dynamicSwitch: true, dynamicPropKeys: ['mode', 'title'] },
    })
    for (const output of [buildDynamicLayoutTemplate('<view />', layout, [layout], ['mode', 'title'], platform), compiled.template!]) {
      const { elements } = scanTemplate(output, 'pages/index/index.wxml', new Set(), false, syntax)
      const wrapper = elements.find(element => element.tag === layout.tagName)!
      expect(wrapper.attrs.map(attr => attr.name)).toEqual(['__wvSlotOwnerId', 'mode', 'title'])
      for (const attr of wrapper.attrs.filter(attr => attr.name !== '__wvSlotOwnerId')) {
        const value = output.slice(attr.valueStart, attr.valueEnd)
        expect(value).toMatch(/^\{\{.*\}\}$/)
        const expression = decodeAttribute(value, syntax, syntax === 'xml', attr.quote).slice(2, -2)
        expect(runInNewContext(expression, { __wv_page_layout_props: {} })).toBe(layout.props![attr.name])
        for (const override of ['动态标题', '', null, false]) {
          expect(runInNewContext(expression, { __wv_page_layout_props: { [attr.name]: override } })).toBe(override)
        }
      }
    }
  })
})
