import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

const ROUTE = '/subpackages/lab/class-binding/index'
const PROBES = [
  ['class-object', 'Object Syntax'],
  ['class-static-object', 'Static + Object'],
  ['class-reactive', 'Reactive Object'],
  ['class-array', 'Array Syntax'],
  ['class-cond-array', 'Conditional Array'],
  ['class-array-key', 'Array + Key'],
  ['style-object', 'Style Object'],
  ['style-array', 'Style Array'],
  ['style-string', 'Style String'],
  ['style-var', 'Style Variable'],
] as const

function probeSelector(key: string) {
  return `//*[@id="class-binding-probe-${key}"]`
}

function checkpoint(id: string, active: boolean, error: boolean, ghost: boolean, round: boolean): DomCheckpoint {
  const color = error ? 'rgb(185, 28, 28)' : active ? 'rgb(255, 255, 255)' : 'rgb(31, 26, 63)'
  const nodes = PROBES.flatMap<DomNodeExpectation>(([key, title]) => [
    { selector: `${probeSelector(key)}//*[contains(@class, "font-semibold")]`, query: 'xpath', text: title },
    { selector: probeSelector(key), query: 'xpath', visible: true },
  ])
  for (const key of ['class-static-object', 'class-reactive', 'class-array', 'class-cond-array', 'class-array-key', 'style-object']) {
    nodes.push({ selector: probeSelector(key), query: 'xpath', styles: { color } })
  }
  for (const key of ['class-reactive', 'class-array-key', 'style-object']) {
    nodes.push({ selector: probeSelector(key), query: 'xpath', styles: { 'border-top-style': ghost ? 'dashed' : 'solid' } })
  }
  nodes.push(
    { selector: probeSelector('class-object'), query: 'xpath', styles: { 'color': active ? 'rgb(255, 255, 255)' : 'rgb(31, 26, 63)', 'border-top-style': 'solid' } },
    { selector: probeSelector('class-static-object'), query: 'xpath', styles: { 'border-top-style': 'dashed' } },
    { selector: probeSelector('style-array'), query: 'xpath', styles: { opacity: ghost ? '0.78' : '1' } },
    { selector: probeSelector('style-string'), query: 'xpath', styles: { 'color': error ? 'rgb(185, 28, 28)' : 'rgb(31, 26, 63)', 'font-size': { rpx: active ? 26 : 24 } } },
    ...['style-object', 'style-array'].map(key => ({ selector: probeSelector(key), query: 'xpath' as const, styles: { 'border-top-left-radius': { rpx: round ? 999 : 18 } } })),
    { selector: probeSelector('style-var'), query: 'xpath', styles: { 'color': error ? 'rgb(239, 68, 68)' : 'rgb(37, 99, 235)', 'border-top-color': error ? 'rgb(239, 68, 68)' : 'rgb(37, 99, 235)' } },
  )
  return { id, route: ROUTE, action: `${id} 场景：检查十个样例的实际文本、计算样式和布局尺寸`, nodes }
}

export const classBindingCheckpoints = [
  checkpoint('initial', true, false, false, false),
  checkpoint('base', false, false, false, false),
  checkpoint('all-on', true, true, true, true),
  checkpoint('mixed', true, false, false, true),
  checkpoint('error-ghost', false, true, true, false),
]

export async function readBindingState(page: any) {
  return await page.callMethod('runE2EState')
}
