import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import { AppView } from './view'

let root: ReturnType<typeof createReactMiniProgramRoot> | undefined

Page({
  onLoad() {
    root = createReactMiniProgramRoot(this, { renderMode: 'static-bindings' })
    root.render(createElement(AppView))
  },
  __weapp_vite_react_event(event: WechatMiniprogram.CustomEvent) {
    root?.dispatchEvent(event)
  },
  onUnload() {
    root?.unmount()
    root = undefined
  },
})
