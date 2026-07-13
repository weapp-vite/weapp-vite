import { createElement } from 'react'
import { ReactStaticPage } from 'virtual:react-static-binding-spike-page'
import { createReactMiniProgramRoot } from '../../runtime/renderer'

const roots = new WeakMap<object, ReturnType<typeof createReactMiniProgramRoot>>()

Page({
  data: {
    slots: {},
  },
  eh(event: WechatMiniprogram.BaseEvent) {
    roots.get(this)?.dispatchEvent(event)
  },
  onLoad() {
    const root = createReactMiniProgramRoot({
      setData: (payload, callback) => this.setData(payload, callback),
    }, { renderMode: 'static-bindings' })
    roots.set(this, root)
    root.render(createElement(ReactStaticPage))
  },
  onUnload() {
    roots.get(this)?.unmount()
    roots.delete(this)
  },
})
