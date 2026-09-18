import { initializePageRoutes, registerApp, registerPage } from '@weapp-vite/web/runtime'
import { html } from 'lit'
import { createRouter } from 'wevu/router'

registerApp({ globalData: { marker: 'production-app' } })
for (const route of ['home', 'native', 'router']) {
  registerPage({}, { id: `pages/${route}/index`, template: () => html`<div>production-${route}</div>` })
}
initializePageRoutes(['pages/home/index', 'pages/native/index', 'pages/router/index'])

document.querySelector('#native').addEventListener('click', () => {
  void globalThis.wx.navigateTo({ url: '/pages/native/index' })
})
document.querySelector('#router').addEventListener('click', () => {
  void createRouter().push('/pages/router/index')
})
