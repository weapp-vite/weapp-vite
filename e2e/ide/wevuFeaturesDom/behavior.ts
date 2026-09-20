import type { TestContext } from 'vitest'
import type { DomCheckpoint, DomNodeExpectation, DomScope } from '../../utils/domAcceptance/types'
import { expect } from 'vitest'
import { createDomAcceptance } from '../../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'
import { getSharedMiniProgram, releaseSharedMiniProgram } from '../wevu-features.runtime.shared'

export function textNode(selector: string, text: string, scope?: DomScope[]): DomNodeExpectation {
  return { selector, text, scope }
}

export function checkpoint(id: string, action: string, nodes: DomNodeExpectation[]) {
  return { id, action, nodes }
}

export async function withBehaviorPage(
  context: TestContext,
  pageName: string,
  checkpoints: Omit<DomCheckpoint, 'route'>[],
  test: (page: any, check: (id: string) => Promise<unknown>) => Promise<void>,
) {
  const route = `/pages/${pageName}/index`
  const acceptance = createDomAcceptance(context, 'e2e-apps/wevu-features', checkpoints.map(item => ({ ...item, route })))
  const miniProgram = await getSharedMiniProgram()
  try {
    const page = await miniProgram.reLaunch(route)
    expect(page, `Failed to launch ${route}`).toBeTruthy()
    await test(page, id => acceptance.check(id, miniProgram, page))
  }
  finally {
    await releaseSharedMiniProgram(miniProgram)
  }
}

export async function runPageMethod(page: any, method = 'runE2E') {
  const result = await page.callMethodWithOptions(method, { routeOnly: true, timeout: 60_000 })
  expect(result?.ok, JSON.stringify(result)).toBe(true)
  return result
}

export async function tapControl(page: any, selector: string, scope: string[] = []) {
  let root = page
  for (const component of scope) {
    const elements = await root.$$(component, { fallback: false, timeout: 10_000 })
    expect(elements, `${component} component scope`).toHaveLength(1)
    root = elements[0]
  }
  const controls = await root.$$(selector, { fallback: false, timeout: 10_000 })
  expect(controls, `${selector} tap target`).toHaveLength(1)
  await controls[0].tap()
}

export function attrsNodes(updated: boolean): DomNodeExpectation[] {
  return [
    textNode('#ctrl-cycle-tone', `切换 tone：${updated ? 'tone-green' : 'tone-blue'}`),
    textNode('#ctrl-toggle-visible', `切换 visible：${updated ? 'false' : 'true'}`),
    textNode('#ctrl-toggle-border', `边框模式：${updated ? 'strong' : 'dash'}`),
    textNode('#ctrl-bump-seed', `递增 seed：${updated ? 2 : 1}`),
    textNode('#attrs-badge', `state-class = ${updated ? 'tone-green' : 'tone-blue'}`, ['#attrs-feature']),
    textNode('#attrs-flag', `visible = ${updated ? 'false' : 'true'}`, ['#attrs-feature']),
    updated
      ? { scope: ['#attrs-feature'], selector: '#attrs-extra', count: 0 }
      : textNode('#attrs-extra', 'extra-label = seed-1', ['#attrs-feature']),
  ]
}

export function modelNodes(value: string, logs: number, title = '组件内 useModel()') {
  return [
    textNode('#model-parent-value', `parent modelValue = ${value}`.trim()),
    textNode('#model-log-size', `emit logs = ${logs}`),
    textNode('#model-parent-title', `parent title = ${title}`),
    textNode('#model-inner-value', `inner model = ${value}`.trim(), ['#model-feature']),
    textNode('#model-inner-title', `inner title = ${title}`, ['#model-feature']),
  ]
}

export function provideNodes(count: number, theme: string, action: string) {
  return [
    textNode('#provide-state', `provider theme = ${theme}`),
    textNode('#provide-count', `provider count = ${count}`),
    textNode('#provide-last-action', `last action = ${action}`),
    textNode('#inject-panel', `inject theme = ${theme}`, ['#inject-feature']),
    textNode('#inject-count', `inject count = ${count}`, ['#inject-feature']),
    textNode('#inject-last-action', `last action = ${action}`, ['#inject-feature']),
  ]
}

const scopeLeaf = [
  '#scope-middle',
  ...Array.from({ length: 9 }, (_, index) => `#scope-level-${String(index + 1).padStart(2, '0')}`),
  '#scope-leaf',
]

export function injectionScopeNodes() {
  return [
    textNode('#scope-page-provider', 'page provide = page-provide-value'),
    textNode('#scope-app-instance-value', 'app instance inject = app-instance-provide-value', scopeLeaf),
    textNode('#scope-app-setup-value', 'app setup inject = app-setup-provide-value', scopeLeaf),
    textNode('#scope-page-value', 'page inject = page-provide-value', scopeLeaf),
    textNode('#scope-layout-value', 'layout inject = layout-provide-value', scopeLeaf),
    textNode('#scope-component-value', 'component inject = component-provide-value', scopeLeaf),
    textNode('#scope-shadow-value', 'shadow inject = component-shadow-value', scopeLeaf),
    textNode('#scope-slot-value', 'slot inject = slot-provider-value', ['#scope-slot-provider-component', { has: '#scope-slot-leaf' }, '#scope-slot-leaf']),
    textNode('#scope-layout-own-value', 'layout own inject = layout-provide-value', [{ has: '#scope-layout-probe' }, '#scope-layout-probe']),
  ]
}

export function storeNodes(updated: boolean) {
  return [
    textNode('#store-setup-count', `setup count = ${updated ? 4 : 0}`),
    textNode('#store-setup-doubled', `setup doubled = ${updated ? 8 : 0}`),
    textNode('#store-setup-label', `setup label = ${updated ? 'setup-alpha' : 'init'}`),
    textNode('#store-setup-visits', `setup visits = ${updated ? 1 : 0}`),
    textNode('#store-options-count', `options count = ${updated ? 7 : 0}`),
    textNode('#store-options-doubled', `options doubled = ${updated ? 14 : 0}`),
    textNode('#store-options-label', `options label = ${updated ? 'options-patched' : 'zero'}`),
    textNode('#store-options-items-size', `options items = ${updated ? 1 : 0}`),
  ]
}

export function nativeNodes(updated: boolean) {
  const mode = updated ? 'contrast' : 'basic'
  const count = updated ? 2 : 1
  return [
    textNode('#native-interop-toggle', `mode: ${mode}`),
    textNode('#native-interop-count', `count: ${count}`),
    textNode('.native-card__title', '原生组件引入 Vue 组件（static）', ['#native-static-feature', '#native-card-feature']),
    textNode('.native-card__subtitle', 'native -> vue static chain', ['#native-static-feature', '#native-card-feature']),
    textNode('.native-card__badge', 'badge: static', ['#native-static-feature', '#native-card-feature']),
    textNode('.native-uses-vue__note', '这段文本由原生组件传递给 Vue 组件。', ['#native-static-feature']),
    textNode('.native-card__subtitle', `count: ${count}`, ['#native-dynamic-feature', '#native-card-feature']),
    textNode('.native-card__badge', `badge: ${mode}`, ['#native-dynamic-feature', '#native-card-feature']),
    textNode('.native-uses-vue__note', `mode: ${mode}, count: ${count}`, ['#native-dynamic-feature']),
  ]
}

export function styleNodes(updated: boolean): DomNodeExpectation[] {
  const nodes: DomNodeExpectation[] = [
    textNode('#sfc-style-label', 'CSS vars + modules'),
    textNode('#sfc-deep-probe', 'deep'),
    textNode('#sfc-global-probe', 'global'),
    textNode('#sfc-slot-probe', 'slotted fallback'),
  ]
  if (resolveRuntimeProviderName() === 'devtools') {
    nodes.push({
      selector: '#sfc-style-probe',
      visible: true,
      styles: {
        'background-color': updated ? 'rgb(37, 99, 235)' : 'rgb(220, 38, 38)',
        'color': 'rgb(255, 255, 255)',
        'box-sizing': 'border-box',
        'border-top-style': 'solid',
      },
    })
  }
  return nodes
}
