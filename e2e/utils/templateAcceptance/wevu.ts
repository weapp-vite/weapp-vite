import type { TemplateDomRoute } from './index'
import { renderedText, templatePage } from './index'

const INDEX = '/pages/index/index'
const LAYOUTS = '/pages/layouts/index'
const layoutStatus = (value: string) => renderedText('.hero__desc', `当前状态：${value}。可以在 default、admin 与 false 三种布局模式之间切换，作为正式业务页面的基础壳能力。`)

export const WEVU_TEMPLATE_DOM: TemplateDomRoute[] = [
  templatePage(INDEX, [
    renderedText('.hero__title', 'Weapp-vite + Wevu'),
    renderedText('#counter-value', 'count: 0'),
    renderedText('#counter-doubled', 'double: 0'),
  ], [
    {
      id: 'index:increment',
      action: 'tap +1 and inspect count and its computed double',
      tap: { selector: '.action-btn' },
      nodes: [renderedText('#counter-value', 'count: 1'), renderedText('#counter-doubled', 'double: 2')],
    },
  ]),
  templatePage(LAYOUTS, [
    renderedText('.hero__title', '基础模板已接入 src/layouts 约定'),
    layoutStatus('default'),
    { selector: 'component', has: '.layout-default', count: 1 },
  ], [
    {
      id: 'layouts:admin',
      action: 'tap admin and inspect the layout title',
      tap: { selector: '.action-btn--primary' },
      nodes: [layoutStatus('admin'), renderedText('.layout-admin__title', '业务后台布局', [{ has: '.layout-admin__title' }]), { selector: 'component', has: '.layout-default', count: 0 }],
    },
    {
      id: 'layouts:none',
      action: 'tap clear and verify the named layout disappears',
      tap: { selector: '.action-btn--ghost' },
      nodes: [layoutStatus('none'), { selector: 'component', has: '.layout-admin', count: 0 }, { selector: 'component', has: '.layout-default', count: 0 }],
    },
    {
      id: 'layouts:default',
      action: 'applyDefaultLayout and restore the default wrapper',
      method: 'applyDefaultLayout',
      nodes: [layoutStatus('default'), { selector: 'component', has: '.layout-default', count: 1 }, { selector: 'component', has: '.layout-admin', count: 0 }],
    },
  ]),
]

export const WEVU_TDESIGN_TEMPLATE_DOM: TemplateDomRoute[] = [
  templatePage(INDEX, [renderedText('#count-label', '已点击 0 次')], [
    {
      id: 'index:increment',
      action: 'tap the TDesign button and inspect the computed label',
      tap: { selector: 'button', scope: [{ has: 'button' }] },
      nodes: [renderedText('#count-label', '已点击 1 次')],
    },
  ]),
]
