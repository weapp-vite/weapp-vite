import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import { ReactSpikePage } from './view'

const roots = new WeakMap<object, ReturnType<typeof createReactMiniProgramRoot>>()

Page({
  data: {
    root: {
      cn: [],
    },
  },
  eh(event: WechatMiniprogram.BaseEvent) {
    roots.get(this)?.dispatchEvent(event)
  },
  onLoad() {
    const root = createReactMiniProgramRoot({
      setData: (payload, callback) => this.setData(payload, callback),
    })
    roots.set(this, root)
    root.render(createElement(ReactSpikePage))
  },
  onUnload() {
    roots.get(this)?.unmount()
    roots.delete(this)
  },
})
