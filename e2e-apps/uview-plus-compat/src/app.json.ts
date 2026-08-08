import { pages as autoPages } from 'weapp-vite/auto-routes'
import { defineAppJson } from 'weapp-vite/json'

const bootstrapPage = 'pages/bootstrap/index'
const pages = [
  bootstrapPage,
  ...autoPages.filter(page => page !== bootstrapPage),
]

export default defineAppJson({
  pages,
  window: {
    navigationBarTitleText: 'uview-plus compatibility',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
})
