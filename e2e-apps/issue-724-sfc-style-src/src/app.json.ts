import { pages } from 'weapp-vite/auto-routes'
import { defineAppJson } from 'weapp-vite/json'

export default defineAppJson({
  pages,
  componentFramework: 'glass-easel',
  lazyCodeLoading: 'requiredComponents',
})
