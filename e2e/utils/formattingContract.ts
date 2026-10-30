import type { DomCheckpoint, DomNodeExpectation } from './domAcceptance/types'

export const FORMATTING_STEPS = [
  { id: 'initial', target: null, count: 0, bubbled: 0, caught: 0, selected: '', visible: true, label: 'alpha' },
  { id: 'bind', target: '#increment', count: 1, bubbled: 1, caught: 0, selected: '', visible: true, label: 'beta' },
  { id: 'catch', target: '#catch', count: 1, bubbled: 1, caught: 1, selected: '', visible: true, label: 'beta' },
  { id: 'select', target: '#item-second', count: 1, bubbled: 1, caught: 1, selected: 'second', visible: true, label: 'beta' },
  { id: 'hidden', target: '#toggle', count: 1, bubbled: 1, caught: 1, selected: 'second', visible: false, label: 'beta' },
  { id: 'restored', target: '#toggle', count: 1, bubbled: 1, caught: 1, selected: 'second', visible: true, label: 'beta' },
] as const

/** 两种 provider 共用文本与事件契约；真实布局由 DevTools 和浏览器 companion 验证。 */
export function formattingCheckpoints(route: string, computedStyles: boolean): DomCheckpoint[] {
  const withStyles = (styles: NonNullable<DomNodeExpectation['styles']>): Pick<DomNodeExpectation, 'styles'> => computedStyles ? { styles } : {}
  return FORMATTING_STEPS.map<DomCheckpoint>(step => ({
    id: `${route}-${step.id}`,
    route,
    action: `检查格式化前后 ${step.id} 的模板、空白与事件语义`,
    nodes: [
      { selector: '#inline', text: 'A B' },
      { selector: '#spaces', text: `prefix  ${step.label}  suffix`, ...withStyles({ 'white-space': 'pre-wrap' }) },
      { selector: '#expression', text: `${step.count + 1} / ${step.label}` },
      { selector: '#conditional', ...(step.visible ? { text: `visible ${step.count}` } : { count: 0 }) },
      { selector: '#conditional-alternate', ...(step.visible ? { count: 0 } : { text: 'hidden' }) },
      { selector: '.item', count: 2 },
      { selector: '#item-first', text: '0:One' },
      { selector: '#item-second', text: '1:Two', ...withStyles({ 'padding-left': { rpx: 10 } }) },
      { selector: '#state', text: `${step.count}|${step.bubbled}|${step.caught}|${step.selected}` },
      {
        selector: '#style-probe',
        text: 'rpx selector',
        ...withStyles({ 'color': 'rgb(12, 34, 56)', 'width': { rpx: 120 }, 'height': { rpx: 40 }, 'margin-left': { rpx: 8 } }),
      },
    ],
  }))
}
