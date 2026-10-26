import { initializePageRoutes, registerApp, registerPage, registerWebWevuComponent, setupWebViewport } from '@weapp-vite/web/runtime'
import { nextTick, onPageScroll, onReachBottom, ref } from 'wevu'
import { render as template } from './templates/page.wxml?weapp-web-template'
import { render as peerTemplate } from './templates/peer.wxml?weapp-web-template'

setupWebViewport()
registerApp({})

registerPage({
  data: { count: 0, height: 1200, events: [] },
  onPageScroll() {
    this.setData({ events: [...this.data.events, 'scroll'] })
  },
  onReachBottom() {
    this.setData({ count: this.data.count + 1, events: [...this.data.events, 'bottom'] })
  },
  async _appendRows() {
    await Promise.resolve()
    await new Promise(resolve => this.setData({ height: this.data.height + 100 }, resolve))
  },
  _setContentHeight(height) {
    this.setData({ height })
  },
}, { id: 'pages/native/index', template })

registerWebWevuComponent({
  features: { enableOnPageScroll: true, enableOnReachBottom: true },
  setup() {
    const count = ref(0)
    const height = ref(1200)
    const events = ref([])
    onPageScroll(() => events.value.push('scroll'))
    onReachBottom(() => {
      count.value++
      events.value.push('bottom')
    })
    return {
      count,
      height,
      events,
      async _appendRows() {
        await Promise.resolve()
        height.value += 100
        await nextTick()
      },
      _setContentHeight(value) {
        height.value = value
      },
    }
  },
}, { kind: 'page', id: 'pages/wevu/index', template })

registerPage({}, { id: 'pages/peer/index', template: peerTemplate })
initializePageRoutes(['pages/native/index', 'pages/wevu/index', 'pages/peer/index'])
