// .vitepress/theme/index.ts
import type { EnhanceAppContext, Theme } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import Layout from './Layout.vue'
import '@shikijs/vitepress-twoslash/style.css'
import './index.scss'
import 'element-plus/theme-chalk/dark/css-vars.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(Layout)
  },
  enhanceApp({ app }: EnhanceAppContext) {
    // @ts-ignore
    app.use(TwoslashFloatingVue)
  },
} satisfies Theme
