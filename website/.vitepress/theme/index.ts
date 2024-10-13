// .vitepress/theme/index.ts
import type { EnhanceAppContext } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import Theme from 'vitepress/theme'
import '@shikijs/vitepress-twoslash/style.css'
import './index.scss'
import 'element-plus/theme-chalk/dark/css-vars.css'

export default {
  extends: Theme,
  enhanceApp({ app }: EnhanceAppContext) {
    // @ts-ignore
    app.use(TwoslashFloatingVue)
  },
}
