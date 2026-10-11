import type { Page } from '@weapp-vite/miniprogram-automator'
import type { DomNodeExpectation } from '../../utils/domAcceptance/types'
import assert from 'node:assert/strict'

/** XPath 跨越真实组件根，避免把增强插槽生成的组件层级当作用户契约。 */
export function textNode(id: string, text: string): DomNodeExpectation {
  return { selector: `//*[@id="${id}"]`, query: 'xpath', text }
}

export function absentNode(id: string): DomNodeExpectation {
  return { selector: `//*[@id="${id}"]`, query: 'xpath', count: 0 }
}

export function providerNode(label: string, count: number) {
  return textNode(`provider-${label}`, `provider:${count}`)
}

export function leafNodes(probe: string, owner: string, count: number, visible?: boolean) {
  const nodes = [
    textNode(`count-${probe}`, `count:${count}`),
    textNode(`owner-${probe}`, owner),
    textNode(`identity-${probe}`, 'same'),
  ]
  if (visible !== undefined) {
    for (const node of nodes) {
      node.visible = visible
    }
  }
  return nodes
}

export function primaryNodes(count: number) {
  return [providerNode('primary', count), ...leafNodes('primary', 'primary', count)]
}

export function isolationNodes(left: number, right: number) {
  return [
    providerNode('left', left),
    ...leafNodes('left', 'left', left),
    providerNode('right', right),
    ...leafNodes('right', 'right', right),
  ]
}

export function nestingNodes(outer: number, inner: number) {
  return [
    providerNode('outer', outer),
    ...leafNodes('outer-before', 'outer', outer),
    providerNode('inner', inner),
    ...leafNodes('inner-wrapped', 'inner', inner),
    ...leafNodes('inner-internal', 'inner', inner),
    ...leafNodes('inner-named', 'inner', inner),
    ...leafNodes('outer-after', 'outer', outer),
  ]
}

export function lifecycleNodes(count: number) {
  return [textNode('mount-state', 'mounted'), providerNode('current', count), ...leafNodes('current', 'current', count)]
}

export function nativeNodes(count: number) {
  return [
    textNode('native-default', 'native default projection'),
    textNode('native-named', 'native named projection'),
    textNode('native-count', `native:${count}`),
    textNode('native-export-keys', 'increment,label'),
    textNode('native-owner-label', 'filtered-native-owner'),
    textNode('native-private-visible', 'false'),
  ]
}

export function exportedOwnerNodes(count: number) {
  return [
    providerNode('exported-outer', 100),
    ...leafNodes('exported-outer-leaf', 'exported-outer', 100),
    providerNode('exported-inner', count),
    ...leafNodes('exported-internal', 'exported-inner', count),
    ...leafNodes('exported-aliased', 'exported-inner', count),
    ...leafNodes('exported-projected', 'exported-inner', count),
    textNode('native-export-keys', 'increment,label'),
    textNode('native-owner-label', 'public-provider'),
    textNode('native-private-visible', 'false'),
  ]
}

export function unprojectedNodes(open: boolean, options: { closed?: number, forwarded?: number, layout?: boolean } = {}) {
  const { closed = 7, forwarded = 20, layout = false } = options
  const nodes = [
    textNode('outlet-state', open ? 'open' : 'closed'),
    textNode('ready-closed', 'closed:same:1'),
    textNode('ready-forwarded-default', 'forwarded:same:1'),
    textNode('ready-forwarded-named', 'forwarded:same:1'),
    providerNode('closed', closed),
    providerNode('forwarded-outer', 100),
    providerNode('forwarded', forwarded),
  ]
  for (const [probe, owner, count] of [
    ['closed', 'closed', closed],
    ['forwarded-default', 'forwarded', forwarded],
    ['forwarded-named', 'forwarded', forwarded],
  ] as const) {
    nodes.push(...leafNodes(probe, owner, count, layout ? open : undefined))
    nodes.push({ selector: `//button[@id="increment-${probe}"]`, query: 'xpath', visible: layout ? open : undefined })
  }
  return nodes
}

export function keyedNodes(
  open: boolean,
  late: boolean,
  counts: Record<string, number>,
  options: { setups?: Record<string, number>, layout?: boolean } = {},
) {
  const { setups = {}, layout = false } = options
  const nodes = [textNode('outlet-state', open ? 'open' : 'closed')]
  for (const [label, count] of Object.entries(counts)) {
    nodes.push(providerNode(label, count))
    for (const suffix of ['main', 'late']) {
      const probe = `${label}-${suffix}`
      const mounted = suffix === 'main' || late
      nodes.push(textNode(`ready-${probe}`, mounted ? `${label}:same:${setups[label] ?? 1}` : 'waiting'))
      nodes.push(...(mounted ? leafNodes(probe, label, count, layout ? open : undefined) : [absentNode(`count-${probe}`)]))
    }
  }
  return nodes
}

export async function tapButton(page: Page, id: string) {
  const buttons = await page.getElementsByXpath(`//button[@id="${id}"]`, { fallback: false })
  assert.equal(buttons.length, 1, id)
  await buttons[0]!.tap()
}
