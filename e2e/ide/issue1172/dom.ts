import type { Page } from '@weapp-vite/miniprogram-automator'
import type { DomNodeExpectation } from '../../utils/domAcceptance/types'
import { expect } from 'vitest'

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

export function leafNodes(probe: string, owner: string, count: number) {
  return [
    textNode(`count-${probe}`, `count:${count}`),
    textNode(`owner-${probe}`, owner),
    textNode(`identity-${probe}`, 'same'),
  ]
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

export async function tapButton(page: Page, id: string) {
  const buttons = await page.getElementsByXpath(`//button[@id="${id}"]`, { fallback: false })
  expect(buttons, id).toHaveLength(1)
  await buttons[0]!.tap()
}
