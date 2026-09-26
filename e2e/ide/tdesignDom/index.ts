import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

export const TDESIGN_FIXTURE = 'e2e-apps/template-wevu-tdesign-regression'

export function xpathClass(name: string) {
  return `//*[contains(concat(" ", @class, " "), " ${name} ")]`
}

export function renderedText(id: string, text: string): DomNodeExpectation {
  return { selector: `//*[@id="${id}"]`, query: 'xpath', text }
}

export function classText(name: string, text: string): DomNodeExpectation {
  return { selector: xpathClass(name), query: 'xpath', text }
}

export function dashboardNodes(refreshed = false): DomNodeExpectation[] {
  return [
    renderedText('dashboard-title', 'Weapp Studio'),
    renderedText('kpi-label-visits', '今日访问'),
    renderedText('kpi-value-visits', refreshed ? '1286' : '1283'),
    renderedText('kpi-label-conversion', '转化率'),
    renderedText('kpi-value-conversion', refreshed ? '26' : '25'),
    renderedText('kpi-label-tickets', '待处理'),
    renderedText('kpi-value-tickets', refreshed ? '16' : '17'),
    renderedText('kpi-label-satisfaction', '满意度'),
    renderedText('kpi-value-satisfaction', '4.8'),
  ]
}

export const layoutNodes = [
  renderedText('layout-current-state', '当前状态：default。可在 default、admin 与 false 三种模式之间切换，用来承接后台页、运营页或沉浸式页面。'),
  renderedText('layout-option-default', 'default 布局'),
  renderedText('layout-option-admin', 'admin 布局'),
  renderedText('layout-option-none', '关闭布局'),
]

export function feedbackCheckpoint(id: string, action: string, message = '暂无操作'): DomCheckpoint {
  return {
    id,
    route: '/pages/layout-feedback/index',
    action,
    nodes: [
      renderedText('layout-feedback-latest-action', message),
      { selector: xpathClass('t-popup'), query: 'xpath', count: 0 },
    ],
  }
}

export function dialogCheckpoint(id: string, kind: 'Alert' | 'Confirm', sequence = 1): DomCheckpoint {
  return {
    id,
    route: '/pages/layout-feedback/index',
    action: `打开 ${kind}，检查 layout 弹窗标题、正文和按钮`,
    nodes: [
      classText('t-dialog__header', `页面 ${kind} #${sequence}`),
      classText('t-dialog__body-text', kind === 'Alert'
        ? '这是页面直接调用 useDialog() 后，由 layout 内 t-dialog 承载的弹窗。'
        : '确认后会写入日志，方便观察页面与 layout 宿主之间的通信。'),
      { selector: xpathClass('t-popup'), query: 'xpath', count: 1 },
      { selector: `${xpathClass('t-dialog__footer')}//button`, query: 'xpath', count: kind === 'Alert' ? 1 : 2 },
    ],
  }
}

export async function tapRendered(page: any, selector: string) {
  if (typeof page.getElementsByXpath !== 'function') {
    throw new TypeError('DOM interaction requires rendered XPath queries')
  }
  const elements = await page.getElementsByXpath(selector, { fallback: false, timeout: 10_000 })
  if (elements.length !== 1 || typeof elements[0]?.tap !== 'function') {
    throw new Error(`Expected one tappable rendered element: ${selector}, received ${elements.length}`)
  }
  await elements[0].tap()
}
