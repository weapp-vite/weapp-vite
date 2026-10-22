import { initializePageRoutes, registerApp, registerPage, registerWebWevuComponent, setupWebViewport } from '@weapp-vite/web/runtime'
import { html } from 'lit'
import { nextTick, onPageScroll, onReachBottom, ref } from 'wevu'

setupWebViewport()
registerApp({})
function template(state) {
  return html`
  <div id="content" style="height:${state.height}px">
    <span id="count">${state.count}</span>
    <span id="events">${state.events.join(',')}</span>
  </div>
`
}

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

registerPage({}, { id: 'pages/peer/index', template: () => html`<div id="peer">Peer</div>` })
initializePageRoutes(['pages/native/index', 'pages/wevu/index', 'pages/peer/index'])
