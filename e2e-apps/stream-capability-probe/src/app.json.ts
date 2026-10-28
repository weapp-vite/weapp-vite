import routes from 'weapp-vite/auto-routes'
import { defineAppJson } from 'weapp-vite/json'

const nativePage = 'pages/index/index'

export default defineAppJson({
  pages: [nativePage, ...routes.pages.filter(page => page !== nativePage)],
  window: {
    navigationBarTitleText: '流式能力探针',
  },
  style: 'v2',
  renderer: 'webview',
})
