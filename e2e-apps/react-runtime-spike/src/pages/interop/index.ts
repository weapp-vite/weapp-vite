import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import { ReactInteropPage } from './view'

const roots = new WeakMap<object, ReturnType<typeof createReactMiniProgramRoot>>()

async function readInteropE2E(currentPage: any) {
  const requireComponent = (owner: any, selector: string) => {
    const component = owner?.selectComponent?.(selector)
    if (!component) {
      throw new Error(`Missing interop component ${selector}`)
    }
    return component
  }
  const createScopedQuery = (owner: any) => typeof owner.createSelectorQuery === 'function'
    ? owner.createSelectorQuery()
    : wx.createSelectorQuery().in({ $: owner, $el: owner } as any)
  const readSlot = (owner: any, selector: string) => new Promise((resolve) => {
    createScopedQuery(owner)
      .select(selector)
      .fields({ dataset: true, size: true }, resolve)
      .exec()
  })

  const reactNative = requireComponent(currentPage, '#react-parent-native')
  const reactWevu = requireComponent(currentPage, '#react-parent-wevu')
  const nativeParent = requireComponent(currentPage, '#native-parent-component')
  const nativeWevu = requireComponent(nativeParent, '#native-parent-wevu')
  const nativeReact = requireComponent(nativeParent, '#native-parent-react')
  const wevuParent = requireComponent(currentPage, '#wevu-parent-component')
  const wevuNative = requireComponent(wevuParent, '#wevu-parent-native')
  const wevuReact = requireComponent(wevuParent, '#wevu-parent-react')

  const props = [reactNative, reactWevu, nativeWevu, nativeReact, wevuNative, wevuReact]
    .map(component => ({
      label: component.data.label,
      value: component.data.value,
    }))

  const slots = await Promise.all([
    readSlot(currentPage, '#slot-react-to-native'),
    readSlot(currentPage, '#slot-react-to-wevu'),
    readSlot(nativeParent, '#slot-native-to-wevu'),
    readSlot(nativeParent, '#slot-native-to-react'),
    readSlot(wevuParent, '#slot-wevu-to-native'),
    readSlot(wevuParent, '#slot-wevu-to-react'),
  ]) as any[]
  const reactResults = await new Promise<string[]>((resolve) => {
    createScopedQuery(currentPage)
      .select('#react-native-result')
      .fields({ dataset: true }, () => {})
      .select('#react-wevu-result')
      .fields({ dataset: true }, () => {})
      .exec((nodes: any[]) => resolve(nodes.map(node => node?.dataset?.e2eResult)))
  })

  return {
    nativeParent: nativeParent.data,
    props,
    reactResults,
    slots: slots.map(slot => ({
      height: Number(slot?.height ?? 0),
      name: slot?.dataset?.e2eSlot,
      width: Number(slot?.width ?? 0),
    })),
    wevuParent: wevuParent.data,
  }
}

Page({
  data: {
    slots: {},
  },
  __weapp_vite_react_event(event: WechatMiniprogram.BaseEvent) {
    roots.get(this)?.dispatchEvent(event)
  },
  async _readInteropE2E() {
    return await readInteropE2E(this)
  },
  onLoad() {
    const root = createReactMiniProgramRoot(this, { renderMode: 'static-bindings' })
    roots.set(this, root)
    root.render(createElement(ReactInteropPage))
  },
  onUnload() {
    roots.get(this)?.unmount()
    roots.delete(this)
  },
})
